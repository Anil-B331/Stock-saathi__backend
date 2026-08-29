const { pool } = require('../db');

/**
 * Creates a stock log entry in the database.
 * Does NOT update the item quantity — that's handled atomically in the controller.
 */
const createLog = async (item_id, user_id, type, quantity_changed) => {
  const result = await pool.query(
    `INSERT INTO stock_logs (item_id, user_id, type, quantity_changed)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [item_id, user_id, type, quantity_changed]
  );
  return result.rows[0];
};

/**
 * Fetches all stock log entries for a specific item, ordered newest first.
 * Joins with users table to include the user's name.
 */
const getLogsByItemId = async (item_id) => {
  const result = await pool.query(
    `SELECT sl.*, u.name AS user_name
     FROM stock_logs sl
     LEFT JOIN users u ON sl.user_id = u.id
     WHERE sl.item_id = $1
     ORDER BY sl.created_at DESC`,
    [item_id]
  );
  return result.rows;
};

module.exports = {
  createLog,
  getLogsByItemId,
};
