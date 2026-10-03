const { body, param, query, validationResult } = require('express-validator');
const { ApiError } = require('./errorHandler');

const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(400, 'Validation failed', errors));
};

const id = (name = 'id') => param(name).isInt({ min: 1 }).withMessage(`${name} must be a positive integer`).toInt();
const password = (field = 'password') =>
  body(field).isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Za-z]/).withMessage('Password must contain a letter')
    .matches(/\d/).withMessage('Password must contain a number');

const rules = {
  register: [
    body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[A-Za-z0-9_.-]+$/)
      .withMessage('Username must be 3-50 chars: letters, numbers, _ . -'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
    password(),
    body('first_name').optional().trim().isLength({ max: 50 }),
    body('last_name').optional().trim().isLength({ max: 50 }),
  ],
  login: [
    body('login').trim().notEmpty().withMessage('Email or username required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  changePassword: [body('current_password').notEmpty(), password('new_password')],
  profile: [
    body('first_name').optional().trim().isLength({ max: 50 }),
    body('last_name').optional().trim().isLength({ max: 50 }),
    body('bio').optional().trim().isLength({ max: 2000 }),
    body('avatar').optional().trim().isLength({ max: 255 }),
  ],
  adminCreateUser: [
    body('username').trim().isLength({ min: 3, max: 50 }),
    body('email').trim().isEmail().normalizeEmail(),
    password(),
    body('role').isIn(['admin', 'editor', 'author', 'subscriber']),
  ],
  adminUpdateUser: [
    id(),
    body('role').optional().isIn(['admin', 'editor', 'author', 'subscriber']),
    body('is_active').optional().isBoolean().toBoolean(),
    body('email').optional().trim().isEmail().normalizeEmail(),
  ],
  post: [
    body('title').trim().isLength({ min: 3, max: 255 }).withMessage('Title must be 3-255 characters'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('status').optional().isIn(['draft', 'published', 'archived']),
    body('category_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('tags').optional().isArray({ max: 20 }),
    body('tags.*').optional().isString().trim().isLength({ min: 1, max: 50 }),
  ],
  postUpdate: [
    param('id').isInt({ min: 1 }).toInt(),
    body('title').optional().trim().isLength({ min: 3, max: 255 }),
    body('content').optional().trim().notEmpty(),
    body('status').optional().isIn(['draft', 'published', 'archived']),
    body('category_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('tags').optional().isArray({ max: 20 }),
  ],
  category: [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim(),
    body('parent_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('display_order').optional().isInt().toInt(),
  ],
  tag: [body('name').trim().isLength({ min: 1, max: 50 }), body('description').optional().trim()],
  comment: [
    body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Comment must be 1-5000 characters'),
    body('parent_id').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
  ],
  commentStatus: [id(), body('status').isIn(['pending', 'approved', 'spam', 'trash'])],
  mediaUpdate: [id(), body('alt_text').optional().trim().isLength({ max: 255 }), body('caption').optional().trim()],
  pagination: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  id,
};

module.exports = { validate, rules };
