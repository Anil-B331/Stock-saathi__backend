const request = require('supertest');
const app = require('../index');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
const ownerToken = jwt.sign({ userId: 1, role: 'owner' }, JWT_SECRET);

// Mock the entire db module so we don't need a real PostgreSQL connection
jest.mock('../db', () => {
  const mockClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    pool: {
      connect: jest.fn(() => Promise.resolve(mockClient)),
      query: jest.fn(),
    },
    query: jest.fn(),
    _mockClient: mockClient,
  };
});

describe('Stock Log Endpoints', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = require('../db')._mockClient;
  });

  describe('POST /api/stock-logs', () => {
    it('should log a stock-out of 5 and correctly reduce quantity from 20 to 15', async () => {
      // Simulate DB transaction flow
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Rice', quantity: 20 }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Rice', quantity: 15 }] }) // UPDATE items
        .mockResolvedValueOnce({ rows: [{ id: 1, item_id: 1, type: 'out', quantity_changed: 5 }] }) // INSERT stock_logs
        .mockResolvedValueOnce({}); // COMMIT

      const res = await request(app)
        .post('/api/stock-logs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ item_id: 1, type: 'out', quantity: 5 });

      expect(res.statusCode).toEqual(201);
      expect(res.body.item.quantity).toEqual(15);
      expect(res.body.log.quantity_changed).toEqual(5);
      expect(res.body.log.type).toEqual('out');
    });

    it('should prevent stock-out that would reduce quantity below 0', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Rice', quantity: 3 }] }) // SELECT FOR UPDATE — only 3 in stock
        .mockResolvedValueOnce({}); // ROLLBACK

      const res = await request(app)
        .post('/api/stock-logs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ item_id: 1, type: 'out', quantity: 5 }); // trying to remove 5, but only 3 exist

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/Cannot remove 5 units/);
    });

    it('should reject an unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/stock-logs')
        .send({ item_id: 1, type: 'out', quantity: 5 });

      expect(res.statusCode).toEqual(401);
    });

    it('should log a stock-in of 10 and correctly increase quantity from 20 to 30', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Rice', quantity: 20 }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Rice', quantity: 30 }] }) // UPDATE items
        .mockResolvedValueOnce({ rows: [{ id: 1, item_id: 1, type: 'in', quantity_changed: 10 }] }) // INSERT stock_logs
        .mockResolvedValueOnce({}); // COMMIT

      const res = await request(app)
        .post('/api/stock-logs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ item_id: 1, type: 'in', quantity: 10 });

      expect(res.statusCode).toEqual(201);
      expect(res.body.item.quantity).toEqual(30);
    });
  });
});
