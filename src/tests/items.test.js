const request = require('supertest');
const app = require('../index');
const itemModel = require('../models/itemModel');
const jwt = require('jsonwebtoken');

jest.mock('../models/itemModel');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
const ownerToken = jwt.sign({ userId: 1, role: 'owner' }, JWT_SECRET);
const staffToken = jwt.sign({ userId: 2, role: 'staff' }, JWT_SECRET);

describe('Items Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/items', () => {
    it('should create an item successfully (valid create)', async () => {
      itemModel.createItem.mockResolvedValue({
        id: 1,
        name: 'Test Item',
        quantity: 10,
      });

      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Test Item',
          quantity: 10,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id', 1);
      expect(itemModel.createItem).toHaveBeenCalledTimes(1);
    });

    it('should fail to create item if name is missing (invalid create)', async () => {
      const res = await request(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          quantity: 10,
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/name is required/i);
      expect(itemModel.createItem).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/items/:id', () => {
    it('should deny staff from deleting an item', async () => {
      const res = await request(app)
        .delete('/api/items/1')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/Requires owner role/i);
      expect(itemModel.deleteItem).not.toHaveBeenCalled();
    });

    it('should allow owner to delete an item', async () => {
      itemModel.deleteItem.mockResolvedValue({ id: 1, name: 'Test Item' });

      const res = await request(app)
        .delete('/api/items/1')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(itemModel.deleteItem).toHaveBeenCalledWith('1');
    });
  });
});
