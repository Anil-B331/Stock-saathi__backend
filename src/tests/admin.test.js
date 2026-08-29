const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../index');
const userModel = require('../models/userModel');

jest.mock('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
const superToken = jwt.sign({ userId: 1, role: 'superadmin' }, JWT_SECRET);
const ownerToken = jwt.sign({ userId: 2, role: 'owner' }, JWT_SECRET);

describe('Admin Endpoints (superadmin only)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/stats', () => {
    it('returns counts for each status when called by a superadmin', async () => {
      userModel.getUsersByStatus.mockImplementation(async (status) => {
        if (status === 'pending') return [{ id: 10 }, { id: 11 }];
        if (status === 'approved') return [{ id: 1 }];
        if (status === 'rejected') return [];
        return [];
      });

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        pending_count: 2,
        approved_count: 1,
        rejected_count: 0,
      });
    });

    it('rejects non-superadmin callers with 403', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/super-admin/i);
    });

    it('rejects unauthenticated callers with 401', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/admin/users', () => {
    it('lists all users when no status filter is given', async () => {
      userModel.getUsersByStatus.mockResolvedValue([
        { id: 1, name: 'Alice', status: 'pending' },
        { id: 2, name: 'Bob', status: 'approved' },
      ]);

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.count).toEqual(2);
      expect(userModel.getUsersByStatus).toHaveBeenCalledWith(null);
    });

    it('passes a status filter through to the model', async () => {
      userModel.getUsersByStatus.mockResolvedValue([{ id: 1, name: 'Alice', status: 'pending' }]);

      const res = await request(app)
        .get('/api/admin/users?status=pending')
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.statusCode).toEqual(200);
      expect(userModel.getUsersByStatus).toHaveBeenCalledWith('pending');
    });

    it('rejects invalid status filters with 400', async () => {
      const res = await request(app)
        .get('/api/admin/users?status=banana')
        .set('Authorization', `Bearer ${superToken}`);

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('PUT /api/admin/users/:id/status', () => {
    it('approves a pending user', async () => {
      userModel.updateUserStatus.mockResolvedValue({
        id: 5, name: 'New Shop', email: 'shop@test.com', status: 'approved',
      });

      const res = await request(app)
        .put('/api/admin/users/5/status')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'approved' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.user.status).toEqual('approved');
      // Express delivers :id as a string — that's fine, the model accepts both.
      expect(userModel.updateUserStatus).toHaveBeenCalledWith('5', 'approved');
    });

    it('rejects a user and returns the updated record', async () => {
      userModel.updateUserStatus.mockResolvedValue({
        id: 6, name: 'Bad Shop', email: 'bad@test.com', status: 'rejected',
      });

      const res = await request(app)
        .put('/api/admin/users/6/status')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'rejected' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.user.status).toEqual('rejected');
    });

    it('returns 404 when the user does not exist', async () => {
      userModel.updateUserStatus.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/admin/users/999/status')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'approved' });

      expect(res.statusCode).toEqual(404);
    });

    it('returns 400 for invalid status values', async () => {
      const res = await request(app)
        .put('/api/admin/users/5/status')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ status: 'banned' });

      expect(res.statusCode).toEqual(400);
    });

    it('forbids non-superadmin callers', async () => {
      const res = await request(app)
        .put('/api/admin/users/5/status')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'approved' });

      expect(res.statusCode).toEqual(403);
    });
  });
});
