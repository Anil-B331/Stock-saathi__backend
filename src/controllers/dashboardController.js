const dashboardModel = require('../models/dashboardModel');
const itemModel = require('../models/itemModel');

/**
 * GET /api/dashboard
 * Returns aggregated dashboard statistics:
 * - Valuation metrics (cost value hidden for staff)
 * - Top 5 moving items
 * - Low stock items
 */
const getDashboard = async (req, res) => {
  try {
    const summary = await dashboardModel.getDashboardSummary();
    const isStaff = req.user && req.user.role === 'staff';

    // Mask financial cost details for staff users
    if (isStaff) {
      delete summary.metrics.total_cost_value;
      summary.low_stock_items = summary.low_stock_items.map(item => {
        const { cost_price, ...rest } = item;
        return rest;
      });
    }

    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/dashboard/low-stock
 * Returns all items currently at or below their low-stock threshold.
 */
const getLowStock = async (req, res) => {
  try {
    const items = await itemModel.getLowStockItems();
    const isStaff = req.user && req.user.role === 'staff';

    const sanitizedItems = isStaff 
      ? items.map(({ cost_price, ...rest }) => rest)
      : items;

    res.status(200).json(sanitizedItems);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getDashboard,
  getLowStock,
};
