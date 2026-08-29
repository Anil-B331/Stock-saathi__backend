const express = require('express');
const { signup, login, updatePreferences } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.put('/preferences', authenticateToken, updatePreferences);

module.exports = router;
