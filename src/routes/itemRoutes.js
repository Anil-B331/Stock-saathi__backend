const express = require('express');
const { getItems, getItem, createItem, updateItem, deleteItem } = require('../controllers/itemController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// All item routes are protected
router.use(authenticateToken);

router.get('/', getItems);
router.get('/:id', getItem);
router.post('/', createItem);
router.put('/:id', updateItem);
// Require owner role for delete route specifically at the middleware level
router.delete('/:id', requireRole('owner'), deleteItem);

module.exports = router;
