const userModel = require('../models/userModel');

/**
 * GET /api/admin/users?status=pending|approved|rejected
 * Lists non-superadmin users, optionally filtered by status.
 * Superadmin only.
 */
const listUsers = async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: "Invalid status filter. Must be 'pending', 'approved', or 'rejected'.",
      });
    }
    const users = await userModel.getUsersByStatus(status || null);
    res.status(200).json({ users, count: users.length });
  } catch (error) {
    console.error('Error listing users (admin):', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * PUT /api/admin/users/:id/status
 * Body: { status: 'approved' | 'rejected' | 'pending' }
 * Superadmin only.
 */
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Must be 'pending', 'approved', or 'rejected'.",
      });
    }

    const updated = await userModel.updateUserStatus(id, status);
    if (!updated) {
      return res.status(404).json({ error: 'User not found or cannot be modified.' });
    }

    res.status(200).json({ user: updated });
  } catch (error) {
    console.error('Error updating user status (admin):', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

/**
 * GET /api/admin/stats
 * Quick counts for the admin dashboard header.
 */
const getStats = async (req, res) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      userModel.getUsersByStatus('pending'),
      userModel.getUsersByStatus('approved'),
      userModel.getUsersByStatus('rejected'),
    ]);
    res.status(200).json({
      pending_count: pending.length,
      approved_count: approved.length,
      rejected_count: rejected.length,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = { listUsers, updateStatus, getStats };
