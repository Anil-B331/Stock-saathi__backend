const express = require('express');
const { getDashboard, getLowStock } = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// All dashboard endpoints require authentication
router.use(authenticateToken);

router.get('/', getDashboard);
router.get('/low-stock', getLowStock);

module.exports = router;
