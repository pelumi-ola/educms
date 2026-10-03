const { verifyAccess } = require('../utils/tokens');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('./errorHandler');

const load = async (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const payload = verifyAccess(header.slice(7));
  const user = await User.findById(payload.sub);
  return user && user.is_active ? user : null;
};

const authenticate = asyncHandler(async (req, res, next) => {
  let user;
  try { user = await load(req); } catch (e) { throw new ApiError(401, 'Invalid or expired token'); }
  if (!user) throw new ApiError(401, 'Authentication required');
  req.user = user;
  next();
});

// Attaches req.user when a valid token is present, otherwise continues anonymously.
const optionalAuth = asyncHandler(async (req, res, next) => {
  try { req.user = (await load(req)) || undefined; } catch (e) { req.user = undefined; }
  next();
});

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to do this'));
  next();
};

const isStaff = (user) => !!user && ['admin', 'editor'].includes(user.role);

module.exports = { authenticate, optionalAuth, authorize, isStaff };
