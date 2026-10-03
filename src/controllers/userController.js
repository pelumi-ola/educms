const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { paginate, getPaginationMeta, successResponse } = require('../utils/helpers');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { logActivity } = require('../services/activityService');

exports.list = asyncHandler(async (req, res) => {
  const p = paginate(req.query.page, req.query.limit);
  const { rows, total } = await User.list(req.query, p);
  res.json(successResponse({ users: rows, pagination: getPaginationMeta(total, p.page, p.limit) }));
});

exports.get = asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new ApiError(404, 'User not found');
  res.json(successResponse(User.sanitize(u)));
});

exports.create = asyncHandler(async (req, res) => {
  const { username, email, password, first_name, last_name, role } = req.body;
  if (await User.exists(email, username)) throw new ApiError(409, 'Email or username already in use');
  const user = await User.create({
    username, email, first_name, last_name, role, email_verified: true,
    password_hash: await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS, 10) || 10),
  });
  logActivity(req, 'user.create', 'user', user.user_id, role);
  res.status(201).json(successResponse(user, 'User created'));
});

exports.update = asyncHandler(async (req, res) => {
  const id = req.params.id;
  if (id === req.user.user_id && (req.body.role !== undefined || req.body.is_active === false)) {
    throw new ApiError(400, 'You cannot change your own role or deactivate yourself');
  }
  const u = await User.update(id, req.body);
  if (!u) throw new ApiError(404, 'User not found');
  logActivity(req, 'user.update', 'user', id);
  res.json(successResponse(u, 'User updated'));
});

exports.remove = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.user_id) throw new ApiError(400, 'You cannot delete your own account');
  if (!(await User.remove(req.params.id))) throw new ApiError(404, 'User not found');
  logActivity(req, 'user.delete', 'user', req.params.id);
  res.json(successResponse(null, 'User deleted'));
});
