const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';

/**
 * Validates and normalizes phone numbers.
 * Supports Nepali (+977) mobile numbers (98XXXXXXXX, 97XXXXXXXX) and international formats.
 */
const validateAndNormalizePhone = (phone) => {
  if (!phone || typeof phone !== 'string' || phone.trim() === '') {
    return { valid: true, normalized: null };
  }

  // Remove spaces, hyphens, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // 1. Nepali 10-digit mobile starting with 98 or 97 (e.g., 9841234567)
  if (/^(98|97)\d{8}$/.test(cleaned)) {
    return { valid: true, normalized: `+977${cleaned}` };
  }

  // 2. Nepali with +977 or 00977 prefix (e.g., +9779841234567)
  if (/^\+977(98|97)\d{8}$/.test(cleaned)) {
    return { valid: true, normalized: cleaned };
  }
  if (/^00977(98|97)\d{8}$/.test(cleaned)) {
    return { valid: true, normalized: `+${cleaned.substring(2)}` };
  }

  // 3. Nepali Landline format (+977 1 XXXXXXX or 01XXXXXXX)
  if (/^0[1-9]\d{6,7}$/.test(cleaned)) {
    return { valid: true, normalized: `+977${cleaned.substring(1)}` };
  }
  if (/^\+977[1-9]\d{6,7}$/.test(cleaned)) {
    return { valid: true, normalized: cleaned };
  }

  // 4. Standard international E.164 format (+1..., +44..., +91..., etc.)
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return { valid: true, normalized: cleaned };
  }

  return { 
    valid: false, 
    error: 'Invalid phone format. Please use Nepali format (+977 98XXXXXXXX) or international format (+[code] [number]).' 
  };
};

const signup = async (req, res) => {
  try {
    const { name, email, password, role, phone, currency = 'NPR', language = 'en' } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Please provide all required fields (name, email, password, and role).' });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // 'superadmin' can only be created via the seed script, never via the public signup form.
    if (!['owner', 'staff'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be owner or staff.' });
    }

    // Phone validation
    const phoneCheck = validateAndNormalizePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: phoneCheck.error });
    }

    const existingUser = await userModel.getUserByEmail(email.trim().toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // New self-service signups always start as 'pending' and must be approved by a superadmin.
    const newUser = await userModel.createUser(
      name.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      role,
      phoneCheck.normalized,
      currency,
      language,
      'pending'
    );

    // Pending users get a token so the mobile app can show the "awaiting approval" screen,
    // but they cannot use any other API endpoint until approved.
    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role, status: newUser.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ user: newUser, token });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await userModel.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Approval gate: block pending / rejected users.
    // Superadmins are auto-approved and skip this check.
    if (user.role !== 'superadmin') {
      if (user.status === 'pending') {
        return res.status(403).json({
          error: 'Your account is awaiting approval. You will be able to log in once an admin reviews your sign-up.',
          code: 'ACCOUNT_PENDING',
        });
      }
      if (user.status === 'rejected') {
        return res.status(403).json({
          error: 'Your account was not approved. Please contact StockSathi support for assistance.',
          code: 'ACCOUNT_REJECTED',
        });
      }
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        currency: user.currency || 'NPR',
        language: user.language || 'en',
        status: user.status || 'approved',
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

const updatePreferences = async (req, res) => {
  try {
    const { currency, language, phone } = req.body;
    const userId = req.user.userId;

    if (phone !== undefined) {
      const phoneCheck = validateAndNormalizePhone(phone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ error: phoneCheck.error });
      }
    }

    const updatedUser = await userModel.updateUserPreferences(userId, {
      currency,
      language,
      phone: phone ? validateAndNormalizePhone(phone).normalized : undefined
    });

    res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  signup,
  login,
  updatePreferences,
  validateAndNormalizePhone,
};
