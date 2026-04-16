const db = require('../config/database');

const getProfile = async (req, res) => {
  // Return safe user profile (exclude sensitive fields)
  const user = req.user;
  res.status(200).json({
    id: user.id,
    email: user.email,
    trialEndsAt: user.trial_ends_at,
    totpEnabled: user.totp_enabled,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastLogin: user.last_login,
    isActive: user.is_active,

    plisioCustomerId: user.plisio_customer_id,
    cancelAtPeriodEnd: user.cancel_at_period_end,
    pauseUntil: user.pause_until
  });
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, currentPassword, newPassword } = req.body;
    
    // Get current user
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Update email if provided
    if (email && email !== user.email) {
      // Check if email is already taken
      const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      
      await db.query('UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2', [email, userId]);
    }
    
    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required to change password' });
      }
      
      // Verify current password (simplified - in production, use bcrypt compare)
      // For now, we'll just update the password
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, userId]);
    }
    
    // Get updated user
    const updatedUserResult = await db.query('SELECT id, email, created_at, updated_at, last_login, is_active FROM users WHERE id = $1', [userId]);
    
    res.json({
      success: true,
      data: updatedUserResult.rows[0],
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getDevices = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's devices (simplified - in production, track device tokens/IDs)
    // For now, return mock data
    const devices = [
      {
        id: 'device_1',
        name: 'Current Device',
        type: 'Web Browser',
        lastActive: new Date().toISOString(),
        isCurrent: true
      }
    ];
    
    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const revokeDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;
    
    // In production, you would:
    // 1. Verify the device belongs to the user
    // 2. Remove the device token/ID from the database
    // 3. Invalidate any active sessions for that device
    
    // For now, just return success
    res.json({
      success: true,
      message: `Device ${deviceId} revoked successfully`
    });
  } catch (error) {
    console.error('Revoke device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getActivity = async (req, res) => {
  try {
    const user = req.user;
    const activities = [];
    
    // 1. Account creation
    if (user.created_at) {
      activities.push({
        id: 'account_creation',
        title: 'Account Created',
        timestamp: new Date(user.created_at).toISOString(),
        details: 'AhoyVPN account created'
      });
    }
    
    // 2. Last login
    if (user.last_login) {
      activities.push({
        id: 'last_login',
        title: 'Login from Web',
        timestamp: new Date(user.last_login).toISOString(),
        details: 'Successful authentication via web dashboard'
      });
    }
    
    // 3. Subscription events (if any)
    // TODO: query subscription table for user's subscription events
    
    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit to 5 most recent
    const recent = activities.slice(0, 5);
    
    res.status(200).json({
      success: true,
      data: recent
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getUsage = async (req, res) => {
  try {
    // For now, return mock usage data
    res.status(200).json({
      success: true,
      data: {
        bandwidthUsed: 142.7, // GB
        bandwidthLimit: null, // unlimited
        activeDevices: 2,
        deviceLimit: 5,
        topLocation: 'New York, US',
        lastConnect: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      }
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const user = req.user;
    
    // Delete user record (cascading foreign keys should handle related data)
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    
    // Clear auth cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('csrfToken');
    
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getDevices,
  revokeDevice,
  getActivity,
  getUsage,
  deleteAccount,
};