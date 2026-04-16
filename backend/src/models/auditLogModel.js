const db = require('../config/database');

const AuditLog = {
  async create({ userId, action, ip, metadata }) {
    const query = `
      INSERT INTO audit_logs (user_id, action, ip, metadata, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, created_at
    `;
    const values = [userId, action, ip || null, metadata || {}];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  async findByUserId(userId, limit = 100) {
    const query = `
      SELECT * FROM audit_logs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await db.query(query, [userId, limit]);
    return result.rows;
  },

  async deleteOld(retentionDays = 365) {
    const query = `
      DELETE FROM audit_logs 
      WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
    `;
    const result = await db.query(query);
    return result.rowCount;
  },
};

module.exports = AuditLog;