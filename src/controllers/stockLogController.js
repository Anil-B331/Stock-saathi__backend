const { pool } = require('../db');
const stockLogModel = require('../models/stockLogModel');

/**
 * POST /api/stock-logs
 * Logs a stock in or out event.
 * Atomically updates the item's quantity and inserts a log entry within a single DB transaction.
 * Prevents quantity from going below 0 on stock-out.
 */
const logStockMovement = async (req, res) => {
  const { item_id, type, quantity } = req.body;
  const user_id = req.user.userId;

  // --- Validation ---
  if (!item_id || !type || !quantity) {
    return res.status(400).json({ error: 'item_id, type, and quantity are required.' });
  }
  if (type !== 'in' && type !== 'out') {
    return res.status(400).json({ error: "type must be 'in' or 'out'." });
  }
  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity must be a positive integer.' });
  }

  // Use a DB transaction so the quantity update and log insert are atomic
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the item row to prevent race conditions
    const itemResult = await client.query(
      'SELECT * FROM items WHERE id = $1 FOR UPDATE',
      [item_id]
    );
    const item = itemResult.rows[0];

    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found.' });
    }

    // Prevent negative stock
    if (type === 'out' && item.quantity < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cannot remove ${qty} units. Only ${item.quantity} in stock.`,
      });
    }

    const newQuantity = type === 'in' ? item.quantity + qty : item.quantity - qty;

    // Update item quantity
    const updatedItem = await client.query(
      'UPDATE items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newQuantity, item_id]
    );

    // Write the stock log entry
    const log = await client.query(
      `INSERT INTO stock_logs (item_id, user_id, type, quantity_changed)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [item_id, user_id, type, qty]
    );

    await client.query('COMMIT');

    res.status(201).json({
      log: log.rows[0],
      item: updatedItem.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error logging stock movement:', error);
    res.status(500).json({ error: 'Internal server error.' });
  } finally {
    client.release();
  }
};

/**
 * GET /api/stock-logs/:item_id
 * Returns the movement history for a given item.
 */
const getItemLogs = async (req, res) => {
  try {
    const logs = await stockLogModel.getLogsByItemId(req.params.item_id);
    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = {
  logStockMovement,
  getItemLogs,
};
