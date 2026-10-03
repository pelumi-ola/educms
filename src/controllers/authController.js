const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/tokens');
const { successResponse, generateToken } = require('../utils/helpers');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { sendVerificationEmail } = require('../services/emailService');
const { logActivity } = require('../services/activityService');

const rounds = () => parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
const tokensFor = (user) => ({ access_token: signAccess(user), refresh_token: signRefresh(user) });

exports.register = asyncHandler(async (req, res) => {
  const { username, email, password, first_name, last_name } = req.body;
  if (await User.exists(email, username)) throw new ApiError(409, 'Email or username already in use');
  const verification_token = generateToken(24);
  // Public registration always creates a subscriber; elevated roles are granted by an admin.
  const user = await User.create({
    username, email, first_name, last_name, role: 'subscriber', verification_token,
    password_hash: await bcrypt.hash(password, rounds()),
  });
  sendVerificationEmail(user, verification_token);
  req.user = user;
  logActivity(req, 'user.register', 'user', user.user_id);
  res.status(201).json(successResponse({ user, ...tokensFor(user) }, 'Registration successful'));
});

exports.login = asyncHandler(async (req, res) => {
  const user = await User.findByLogin(req.body.login);
  // Same message for unknown user / wrong password to avoid account enumeration.
  const ok = user && (await bcrypt.compare(req.body.password, user.password_hash));
  if (!ok) throw new ApiError(401, 'Invalid credentials');
  if (!user.is_active) throw new ApiError(403, 'Account is deactivated');
  await User.touchLogin(user.user_id);
  req.user = user;
  logActivity(req, 'user.login', 'user', user.user_id);
  res.json(successResponse({ user: User.sanitize(user), ...tokensFor(user) }, 'Login successful'));
});

exports.refresh = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) throw new ApiError(400, 'refresh_token is required');
  let payload;
  try { payload = verifyRefresh(refresh_token); } catch (e) { throw new ApiError(401, 'Invalid or expired refresh token'); }
  const user = await User.findById(payload.sub);
  if (!user || !user.is_active) throw new ApiError(401, 'Invalid refresh token');
  res.json(successResponse(tokensFor(user)));
});

exports.me = asyncHandler(async (req, res) => res.json(successResponse(User.sanitize(req.user))));

exports.updateMe = asyncHandler(async (req, res) => {
  const { first_name, last_name, bio, avatar } = req.body;
  res.json(successResponse(await User.update(req.user.user_id, { first_name, last_name, bio, avatar }), 'Profile updated'));
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!(await bcrypt.compare(current_password, req.user.password_hash))) throw new ApiError(400, 'Current password is incorrect');
  await User.setPassword(req.user.user_id, await bcrypt.hash(new_password, rounds()));
  logActivity(req, 'user.password_change', 'user', req.user.user_id);
  res.json(successResponse(null, 'Password changed'));
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.verifyEmail(req.params.token);
  if (!user) throw new ApiError(400, 'Invalid or already used verification token');
  res.json(successResponse(user, 'Email verified'));
});
