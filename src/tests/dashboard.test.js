const request = require('supertest');
const app = require('../index');
const jwt = require('jsonwebtoken');
const dashboardModel = require('../models/dashboardModel');
const itemModel = require('../models/itemModel');

jest.mock('../models/dashboardModel');
jest.mock('../models/itemModel');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
const ownerToken = jwt.sign({ userId: 1, role: 'owner' }, JWT_SECRET);
const staffToken = jwt.sign({ userId: 2, role: 'staff' }, JWT_SECRET);

describe('Dashboard Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/dashboard', () => {
    it('should return complete dashboard metrics including cost value for owner', async () => {
      dashboardModel.getDashboardSummary.mockResolvedValue({
        metrics: {
          total_items: 10,
          total_quantity: 150,
          total_cost_value: 15000,
          total_sale_value: 22500,
          low_stock_count: 2,
        },
        top_movers: [
          { id: 1, name: 'Rice 1kg', total_out: 45, current_stock: 5 },
        ],
        low_stock_items: [
          { id: 1, name: 'Rice 1kg', quantity: 5, low_stock_threshold: 10, cost_price: 100, sale_price: 150 },
        ],
      });

      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.metrics).toHaveProperty('total_cost_value', 15000);
      expect(res.body.metrics).toHaveProperty('total_sale_value', 22500);
      expect(res.body.top_movers).toHaveLength(1);
      expect(res.body.low_stock_items[0]).toHaveProperty('cost_price', 100);
    });

    it('should hide total cost value and item cost prices for staff role', async () => {
      dashboardModel.getDashboardSummary.mockResolvedValue({
        metrics: {
          total_items: 10,
          total_quantity: 150,
          total_cost_value: 15000,
          total_sale_value: 22500,
          low_stock_count: 2,
        },
        top_movers: [
          { id: 1, name: 'Rice 1kg', total_out: 45, current_stock: 5 },
        ],
        low_stock_items: [
          { id: 1, name: 'Rice 1kg', quantity: 5, low_stock_threshold: 10, cost_price: 100, sale_price: 150 },
        ],
      });

      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.metrics.total_cost_value).toBeUndefined();
      expect(res.body.metrics).toHaveProperty('total_sale_value', 22500);
      expect(res.body.low_stock_items[0].cost_price).toBeUndefined();
      expect(res.body.low_stock_items[0]).toHaveProperty('sale_price', 150);
    });

    it('should return 401 when unauthorized', async () => {
      const res = await request(app).get('/api/dashboard');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/dashboard/low-stock', () => {
    it('should return items currently below or at threshold', async () => {
      itemModel.getLowStockItems.mockResolvedValue([
        { id: 1, name: 'Rice 1kg', quantity: 2, low_stock_threshold: 5, cost_price: 80, sale_price: 120 },
      ]);

      const res = await request(app)
        .get('/api/dashboard/low-stock')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toEqual('Rice 1kg');
    });
  });
});
