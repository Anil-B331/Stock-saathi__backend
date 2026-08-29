const { pool } = require('../db');

const getAllItems = async () => {
  const result = await pool.query('SELECT * FROM items ORDER BY created_at DESC');
  return result.rows;
};

const getItemById = async (id) => {
  const result = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
  return result.rows[0];
};

const createItem = async (data) => {
  const { name, brand, sku, quantity, category, cost_price, sale_price, photo_url, low_stock_threshold } = data;
  const result = await pool.query(
    `INSERT INTO items (name, brand, sku, quantity, category, cost_price, sale_price, photo_url, low_stock_threshold) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 5)) RETURNING *`,
    [name, brand || null, sku, quantity || 0, category, cost_price, sale_price, photo_url, low_stock_threshold]
  );
  return result.rows[0];
};

const updateItem = async (id, data) => {
  const { name, brand, sku, quantity, category, cost_price, sale_price, photo_url, low_stock_threshold } = data;
  const result = await pool.query(
    `UPDATE items 
     SET name = COALESCE($1, name), 
         brand = COALESCE($2, brand),
         sku = COALESCE($3, sku), 
         quantity = COALESCE($4, quantity), 
         category = COALESCE($5, category), 
         cost_price = COALESCE($6, cost_price), 
         sale_price = COALESCE($7, sale_price), 
         photo_url = COALESCE($8, photo_url),
         low_stock_threshold = COALESCE($9, low_stock_threshold),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $10 RETURNING *`,
    [name, brand, sku, quantity, category, cost_price, sale_price, photo_url, low_stock_threshold, id]
  );
  return result.rows[0];
};

const deleteItem = async (id) => {
  const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

const getLowStockItems = async () => {
  const result = await pool.query(
    'SELECT * FROM items WHERE quantity <= low_stock_threshold ORDER BY (quantity - low_stock_threshold) ASC, created_at DESC'
  );
  return result.rows;
};

module.exports = {
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getLowStockItems,
};
