const express = require('express');
const { listUsers, updateStatus, getStats } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireSuperAdmin } = require('../middleware/requireSuperAdmin');

const router = express.Router();

// All admin routes require authentication + superadmin role.
router.use(authenticateToken, requireSuperAdmin);

router.get('/stats', getStats);
router.get('/users', listUsers);
router.put('/users/:id/status', updateStatus);

module.exports = router;
