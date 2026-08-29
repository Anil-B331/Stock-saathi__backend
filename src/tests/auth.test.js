const request = require('supertest');
const app = require('../index');
const userModel = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock the userModel to prevent real database queries
jest.mock('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
const userToken = jwt.sign({ userId: 1, role: 'owner' }, JWT_SECRET);

describe('Auth Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user with Nepali phone number and return token', async () => {
      userModel.getUserByEmail.mockResolvedValue(null);
      userModel.createUser.mockResolvedValue({
        id: 1,
        name: 'Test Owner',
        email: 'owner@test.com',
        role: 'owner',
        phone: '+9779841234567',
        currency: 'NPR',
        language: 'ne',
        status: 'pending',
      });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test Owner',
          email: 'owner@test.com',
          password: 'password123',
          role: 'owner',
          phone: '9841234567', // Nepali local format
          currency: 'NPR',
          language: 'ne',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('phone', '+9779841234567');
      expect(res.body.user).toHaveProperty('status', 'pending');
      expect(userModel.createUser).toHaveBeenCalledWith(
        'Test Owner',
        'owner@test.com',
        expect.any(String),
        'owner',
        '+9779841234567',
        'NPR',
        'ne',
        'pending'
      );
    });

    it('should reject attempts to self-register as superadmin', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Hacker',
          email: 'hax@test.com',
          password: 'password123',
          role: 'superadmin',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/owner or staff/i);
      expect(userModel.createUser).not.toHaveBeenCalled();
    });

    it('should fail if phone number format is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test Owner',
          email: 'owner@test.com',
          password: 'password123',
          role: 'owner',
          phone: '12345', // invalid phone
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/Invalid phone format/i);
      expect(userModel.createUser).not.toHaveBeenCalled();
    });

    it('should fail if password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test Staff',
          email: 'staff@test.com',
          password: '123',
          role: 'staff',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toMatch(/Password must be at least 6 characters/i);
      expect(userModel.createUser).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login an existing user and return a token with preferences', async () => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      userModel.getUserByEmail.mockResolvedValue({
        id: 2,
        name: 'Existing User',
        email: 'exist@test.com',
        password_hash: hashedPassword,
        role: 'staff',
        phone: '+9779812345678',
        currency: 'NPR',
        language: 'ne',
        status: 'approved',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'exist@test.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', 'exist@test.com');
      expect(res.body.user).toHaveProperty('phone', '+9779812345678');
      expect(res.body.user).toHaveProperty('currency', 'NPR');
      expect(res.body.user).toHaveProperty('status', 'approved');
    });

    it('should return 401 for invalid login attempt', async () => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      userModel.getUserByEmail.mockResolvedValue({
        id: 2,
        name: 'Existing User',
        email: 'exist@test.com',
        password_hash: hashedPassword,
        role: 'staff',
        status: 'approved',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'exist@test.com',
          password: 'wrongpassword',
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toMatch(/Invalid credentials/i);
    });

    it('blocks a pending user with 403 ACCOUNT_PENDING', async () => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      userModel.getUserByEmail.mockResolvedValue({
        id: 3,
        name: 'New Shop',
        email: 'newshop@test.com',
        password_hash: hashedPassword,
        role: 'owner',
        status: 'pending',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'newshop@test.com', password: 'password123' });

      expect(res.statusCode).toEqual(403);
      expect(res.body.code).toEqual('ACCOUNT_PENDING');
      expect(res.body.error).toMatch(/awaiting approval/i);
    });

    it('blocks a rejected user with 403 ACCOUNT_REJECTED', async () => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      userModel.getUserByEmail.mockResolvedValue({
        id: 4,
        name: 'Bad Shop',
        email: 'bad@test.com',
        password_hash: hashedPassword,
        role: 'owner',
        status: 'rejected',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bad@test.com', password: 'password123' });

      expect(res.statusCode).toEqual(403);
      expect(res.body.code).toEqual('ACCOUNT_REJECTED');
    });

    it('allows a superadmin to log in even if status field is missing', async () => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('adminpass', salt);

      userModel.getUserByEmail.mockResolvedValue({
        id: 1,
        name: 'Root Admin',
        email: 'root@stocksaathi.app',
        password_hash: hashedPassword,
        role: 'superadmin',
        status: 'approved',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'root@stocksaathi.app', password: 'adminpass' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.user.role).toEqual('superadmin');
    });
  });

  describe('PUT /api/auth/preferences', () => {
    it('should update user currency and language preferences', async () => {
      userModel.updateUserPreferences.mockResolvedValue({
        id: 1,
        name: 'Test Owner',
        email: 'owner@test.com',
        role: 'owner',
        currency: 'USD',
        language: 'ne',
      });

      const res = await request(app)
        .put('/api/auth/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currency: 'USD',
          language: 'ne',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.user).toHaveProperty('currency', 'USD');
      expect(res.body.user).toHaveProperty('language', 'ne');
    });
  });
});
