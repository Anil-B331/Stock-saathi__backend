const express = require('express');
const { logStockMovement, getItemLogs } = require('../controllers/stockLogController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// All stock log routes require authentication
router.use(authenticateToken);

router.post('/', logStockMovement);
router.get('/:item_id', getItemLogs);

module.exports = router;
