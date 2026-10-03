const Category = require('../models/Category');
const { successResponse } = require('../utils/helpers');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { isStaff } = require('../middleware/auth');
const { remember, invalidate } = require('../services/cacheService');
const { logActivity } = require('../services/activityService');

exports.list = asyncHandler(async (req, res) => {
  const data = isStaff(req.user)
    ? await Category.list({ includeInactive: true })
    : await remember('categories:list', 300, () => Category.list());
  res.json(successResponse(data));
});

exports.get = asyncHandler(async (req, res) => {
  const c = await Category.findById(req.params.id);
  if (!c) throw new ApiError(404, 'Category not found');
  res.json(successResponse(c));
});

exports.create = asyncHandler(async (req, res) => {
  const c = await Category.create(req.body);
  await invalidate('categories:*');
  logActivity(req, 'category.create', 'category', c.category_id, c.name);
  res.status(201).json(successResponse(c, 'Category created'));
});

exports.update = asyncHandler(async (req, res) => {
  if (req.body.parent_id && Number(req.body.parent_id) === req.params.id) throw new ApiError(400, 'A category cannot be its own parent');
  const c = await Category.update(req.params.id, req.body);
  if (!c) throw new ApiError(404, 'Category not found');
  await invalidate('categories:*');
  logActivity(req, 'category.update', 'category', c.category_id, c.name);
  res.json(successResponse(c, 'Category updated'));
});

exports.remove = asyncHandler(async (req, res) => {
  if (!(await Category.remove(req.params.id))) throw new ApiError(404, 'Category not found');
  await invalidate('categories:*');
  logActivity(req, 'category.delete', 'category', req.params.id);
  res.json(successResponse(null, 'Category deleted'));
});
