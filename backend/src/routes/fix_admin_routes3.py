#!/usr/bin/env python3
with open('/home/ahoy/BackEnd/src/routes/adminRoutes.js', 'r') as f:
    content = f.read()

old = '''const { protect, requireRole, loginRateLimiter } = require('../middleware/authMiddleware_new');'''
new = '''const { protectAdmin, loginRateLimiter } = require('../middleware/authMiddleware_new');'''

content = content.replace(old, new)

old2 = '''// Protected routes (authentication required, no CSRF - frontend uses Bearer token)
router.use(protect);
router.use(requireRole('admin'));'''
new2 = '''// Protected routes - use protectAdmin (handles admin JWT tokens correctly)
router.use(protectAdmin);'''

content = content.replace(old2, new2)

with open('/home/ahoy/BackEnd/src/routes/adminRoutes.js', 'w') as f:
    f.write(content)

print("Admin routes fixed to use protectAdmin")
