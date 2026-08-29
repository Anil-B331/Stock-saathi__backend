const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated.' });
  }
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      error: 'Access denied. Super-admin privileges required.',
    });
  }
  next();
};

module.exports = { requireSuperAdmin };
