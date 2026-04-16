const adminMiddleware = {
  protect: (req, res, next) => {
    // TODO: Verify admin role from JWT
    // For now, check for admin API key in header
    const adminKey = req.headers['x-admin-key'];
    if (adminKey && adminKey === process.env.ADMIN_API_KEY) {
      return next();
    }
    res.status(403).json({ error: 'Admin access required' });
  }
};

module.exports = adminMiddleware;