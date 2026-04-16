#!/usr/bin/env python3
with open('/home/ahoy/BackEnd/src/middleware/authMiddleware_new.js', 'r') as f:
    content = f.read()

old = '''// Role-based middleware
const requireRole = (role) => {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Check if user has the required role
    const query = 'SELECT is_admin FROM users WHERE id = $1';
    const result = await db.query(query, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    if (role === 'admin' && !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  };
};'''

new = '''// Role-based middleware
const requireRole = (role) => {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Handle admin role - check admin_users table
    if (role === 'admin' || req.user.type === 'admin') {
      const query = 'SELECT role FROM admin_users WHERE id = $1 AND is_active = true';
      const result = await db.query(query, [req.user.id]);

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      req.user.role = result.rows[0].role;
      return next();
    }

    // Check if user has the required role (non-admin)
    const query = 'SELECT is_admin FROM users WHERE id = $1';
    const result = await db.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (role === 'admin' && !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  };
};'''

if old in content:
    content = content.replace(old, new)
    with open('/home/ahoy/BackEnd/src/middleware/authMiddleware_new.js', 'w') as f:
        f.write(content)
    print("requireRole fixed!")
else:
    print("ERROR: Could not find exact match for requireRole")
    # Try to find it roughly
    idx = content.find('const requireRole')
    if idx >= 0:
        print(f"Found requireRole at index {idx}")
        print(repr(content[idx:idx+500]))
