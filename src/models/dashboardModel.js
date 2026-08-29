const { pool } = require('../db');

/**
 * Retrieves overall metrics for the inventory dashboard:
 * - Stock valuation (Cost & Retail)
 * - Item counts and total quantity
 * - Low-stock count
 * - Top 5 moving items by stock-out volume
 * - Items currently below their low-stock threshold
 */
const getDashboardSummary = async () => {
  // 1. Overall stats and valuation
  const statsResult = await pool.query(`
    SELECT 
      COUNT(*) AS total_items,
      COALESCE(SUM(quantity), 0) AS total_quantity,
      COALESCE(SUM(quantity * cost_price), 0) AS total_cost_value,
      COALESCE(SUM(quantity * sale_price), 0) AS total_sale_value,
      COUNT(CASE WHEN quantity <= low_stock_threshold THEN 1 END) AS low_stock_count
    FROM items
  `);
  const stats = statsResult.rows[0];

  // 2. Top 5 moving items (highest cumulative 'out' stock movements)
  const topMoversResult = await pool.query(`
    SELECT 
      i.id,
      i.name,
      i.sku,
      i.category,
      i.quantity AS current_stock,
      i.sale_price,
      COALESCE(SUM(sl.quantity_changed), 0)::INTEGER AS total_out
    FROM stock_logs sl
    JOIN items i ON sl.item_id = i.id
    WHERE sl.type = 'out'
    GROUP BY i.id, i.name, i.sku, i.category, i.quantity, i.sale_price
    ORDER BY total_out DESC
    LIMIT 5
  `);

  // 3. Low stock items list
  const lowStockResult = await pool.query(`
    SELECT 
      id,
      name,
      sku,
      category,
      quantity,
      low_stock_threshold,
      sale_price,
      cost_price
    FROM items
    WHERE quantity <= low_stock_threshold
    ORDER BY (quantity - low_stock_threshold) ASC, created_at DESC
  `);

  return {
    metrics: {
      total_items: parseInt(stats.total_items, 10),
      total_quantity: parseInt(stats.total_quantity, 10),
      total_cost_value: parseFloat(stats.total_cost_value),
      total_sale_value: parseFloat(stats.total_sale_value),
      low_stock_count: parseInt(stats.low_stock_count, 10),
    },
    top_movers: topMoversResult.rows,
    low_stock_items: lowStockResult.rows,
  };
};

module.exports = {
  getDashboardSummary,
};
