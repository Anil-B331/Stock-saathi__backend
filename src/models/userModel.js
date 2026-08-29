const { pool } = require('../db');

const createUser = async (
  name,
  email,
  passwordHash,
  role,
  phone = null,
  currency = 'NPR',
  language = 'en',
  status = 'pending'
) => {
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, phone, currency, language, status)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'NPR'), COALESCE($7, 'en'), COALESCE($8, 'pending'))
     RETURNING id, name, email, role, phone, currency, language, status, created_at`,
    [name, email, passwordHash, role, phone, currency, language, status]
  );
  return result.rows[0];
};

const getUserByEmail = async (email) => {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
};

const getUserById = async (id) => {
  const result = await pool.query(
    'SELECT id, name, email, role, phone, currency, language, status, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

const updateUserPreferences = async (id, { currency, language, phone }) => {
  const result = await pool.query(
    `UPDATE users
     SET currency = COALESCE($1, currency),
         language = COALESCE($2, language),
         phone = COALESCE($3, phone)
     WHERE id = $4
     RETURNING id, name, email, role, phone, currency, language, status, created_at`,
    [currency, language, phone, id]
  );
  return result.rows[0];
};

/**
 * List users filtered by status. If status is omitted, returns all users.
 * Superadmin accounts are excluded from the list so they don't show up in the approval queue.
 */
const getUsersByStatus = async (status = null) => {
  const query = `
    SELECT id, name, email, role, phone, currency, language, status, created_at
    FROM users
    WHERE role <> 'superadmin'
      ${status ? 'AND status = $1' : ''}
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END,
      created_at DESC
  `;
  const params = status ? [status] : [];
  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Update a user's approval status. Returns the updated user, or null if not found.
 */
const updateUserStatus = async (id, status) => {
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const result = await pool.query(
    `UPDATE users
     SET status = $1
     WHERE id = $2 AND role <> 'superadmin'
     RETURNING id, name, email, role, phone, currency, language, status, created_at`,
    [status, id]
  );
  return result.rows[0] || null;
};

/**
 * Bootstrap helper — promotes an existing user to superadmin (used by the seed script).
 */
const promoteToSuperAdmin = async (email) => {
  const result = await pool.query(
    `UPDATE users
     SET role = 'superadmin', status = 'approved'
     WHERE email = $1
     RETURNING id, name, email, role, status`,
    [email]
  );
  return result.rows[0] || null;
};

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserPreferences,
  getUsersByStatus,
  updateUserStatus,
  promoteToSuperAdmin,
};
