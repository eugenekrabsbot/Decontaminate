const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const exportService = require('../services/exportService');
const AuditLog = require('../models/auditLogModel');
const archiver = require('archiver');

// Ensure exports directory exists
const EXPORTS_DIR = path.join(__dirname, '..', '..', 'data', 'exports');
const RETENTION_HOURS = 24; // default retention period

async function ensureExportsDir() {
  try {
    await fs.access(EXPORTS_DIR);
  } catch {
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
  }
}

/**
 * Generate a secure random token (hex string)
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Create a data export for the authenticated user.
 * Returns { token, downloadUrl, expiresAt }
 */
const createExport = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await ensureExportsDir();

    // Check if user already has a pending or recent export (prevent abuse)
    const recent = await db.query(
      `SELECT * FROM data_exports 
       WHERE user_id = $1 AND status IN ('pending', 'generated') 
       AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (recent.rows.length > 0) {
      const existing = recent.rows[0];
      return res.status(429).json({
        error: 'You already have an active export request',
        token: existing.token,
        expiresAt: existing.expires_at,
        downloadUrl: `/api/user/export/${existing.token}`
      });
    }

    // Generate token and expiry
    const token = generateToken();
    const expiresAt = new Date(Date.now() + RETENTION_HOURS * 60 * 60 * 1000);
    const fileName = `${token}.txt`;
    const filePath = path.join(EXPORTS_DIR, fileName);

    // Insert export record with pending status
    const exportRecord = await db.query(
      `INSERT INTO data_exports 
       (user_id, token, file_path, status, expires_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, token, expires_at, created_at`,
      [userId, token, filePath, 'pending', expiresAt, { retentionHours: RETENTION_HOURS }]
    );

    // Log audit event
    AuditLog.create({
      userId,
      action: 'data_export_requested',
      ip: req.ip,
      metadata: { token, filePath }
    }).catch(err => console.error('Audit log error:', err));

    // In background, generate the export file (non‑blocking)
    // We'll await it for simplicity, but could use a job queue
    try {
      const userData = await exportService.gatherUserData(userId);
      const redactedData = exportService.redactSensitiveFields(userData);
      
      await fs.writeFile(filePath, JSON.stringify(redactedData, null, 2), 'utf8');
      
      // Update status to generated
      await db.query(
        'UPDATE data_exports SET status = $1 WHERE token = $2',
        ['generated', token]
      );

      // Log successful generation
      AuditLog.create({
        userId,
        action: 'data_export_generated',
        ip: req.ip,
        metadata: { token, fileSize: JSON.stringify(redactedData).length }
      }).catch(err => console.error('Audit log error:', err));
    } catch (genError) {
      console.error('Failed to generate export file:', genError);
      await db.query(
        'UPDATE data_exports SET status = $1 WHERE token = $2',
        ['failed', token]
      );
      // Optionally delete the file if it was partially written
      try { await fs.unlink(filePath); } catch {}
      // Log failure
      AuditLog.create({
        userId,
        action: 'data_export_failed',
        ip: req.ip,
        metadata: { token, error: genError.message }
      }).catch(err => console.error('Audit log error:', err));
      return res.status(500).json({ error: 'Failed to generate export' });
    }

    const record = exportRecord.rows[0];
    res.status(202).json({
      message: 'Data export generated successfully',
      token: record.token,
      downloadUrl: `/api/user/export/${record.token}`,
      expiresAt: record.expires_at,
      note: 'The file will be automatically deleted after 24 hours.'
    });
  } catch (error) {
    console.error('Export creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Download an existing export file.
 * Supports optional query parameter ?format=zip to get a ZIP archive.
 */
const downloadExport = async (req, res) => {
  try {
    const { token } = req.params;
    const { format } = req.query;
    const userId = req.user?.id;

    const exportRecord = await db.query(
      `SELECT * FROM data_exports 
       WHERE token = $1 AND status = 'generated' AND expires_at > NOW()`,
      [token]
    );
    if (exportRecord.rows.length === 0) {
      return res.status(404).json({ error: 'Export not found, expired, or already downloaded' });
    }

    const record = exportRecord.rows[0];
    // Ensure the requesting user owns this export (security)
    if (record.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = record.file_path;
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Export file missing' });
    }

    // Update downloaded_at and optionally mark as downloaded (if we want to limit to single download)
    await db.query(
      `UPDATE data_exports SET downloaded_at = NOW() WHERE id = $1`,
      [record.id]
    );

    // Log download event
    AuditLog.create({
      userId,
      action: 'data_export_downloaded',
      ip: req.ip,
      metadata: { token, filePath, format: format || 'json' }
    }).catch(err => console.error('Audit log error:', err));

    // Serve file in requested format
    if (format === 'zip') {
      // Create ZIP archive on the fly
      const archive = archiver('zip', { zlib: { level: 9 } });
      const fileName = `ahoyvpn-data-${token}.txt`;
      const zipFileName = `ahoyvpn-data-${token}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

      archive.pipe(res);
      archive.file(filePath, { name: fileName });
      await archive.finalize();
    } else {
      // Default JSON download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="ahoyvpn-data-${token}.txt"`);
      res.sendFile(filePath); // Express will stream the file
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Admin endpoint: cleanup expired exports (cron job)
 */
const cleanupExpiredExports = async () => {
  try {
    const expired = await db.query(
      `SELECT * FROM data_exports 
       WHERE expires_at <= NOW() AND status != 'expired'`,
      []
    );
    for (const record of expired.rows) {
      try {
        await fs.unlink(record.file_path);
      } catch (err) {
        // File may already be deleted; ignore
      }
      await db.query(
        `UPDATE data_exports SET status = 'expired' WHERE id = $1`,
        [record.id]
      );
    }
    console.log(`Cleaned up ${expired.rows.length} expired exports`);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

module.exports = {
  createExport,
  downloadExport,
  cleanupExpiredExports,
};