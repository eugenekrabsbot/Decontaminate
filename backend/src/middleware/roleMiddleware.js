const { protect } = require('./authMiddleware');

const requireAdmin = (req, res, next) => {
  const isApiRoute = req.path.startsWith('/api');
  if (!req.user) {
    if (!isApiRoute) {
      return res.redirect('/login.html?redirect=' + encodeURIComponent(req.originalUrl));
    }
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.is_admin) {
    if (!isApiRoute) {
      // Non-admin user trying to access admin page - redirect to dashboard
      return res.redirect('/dashboard');
    }
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireAffiliate = (req, res, next) => {
  const isApiRoute = req.path.startsWith('/api');
  if (!req.user) {
    if (!isApiRoute) {
      return res.redirect('/login.html?redirect=' + encodeURIComponent(req.originalUrl));
    }
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.is_affiliate && !req.user.is_admin) {
    // Admins can also access affiliate routes
    if (!isApiRoute) {
      return res.redirect('/dashboard');
    }
    return res.status(403).json({ error: 'Affiliate access required' });
  }
  next();
};

module.exports = { requireAdmin, requireAffiliate };