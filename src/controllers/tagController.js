const Tag = require('../models/Tag');
const { successResponse } = require('../utils/helpers');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { logActivity } = require('../services/activityService');

exports.list = asyncHandler(async (req, res) => res.json(successResponse(await Tag.list())));

exports.create = asyncHandler(async (req, res) => {
  const t = await Tag.create(req.body);
  logActivity(req, 'tag.create', 'tag', t.tag_id, t.name);
  res.status(201).json(successResponse(t, 'Tag created'));
});

exports.update = asyncHandler(async (req, res) => {
  const t = await Tag.update(req.params.id, req.body);
  if (!t) throw new ApiError(404, 'Tag not found');
  res.json(successResponse(t, 'Tag updated'));
});

exports.remove = asyncHandler(async (req, res) => {
  if (!(await Tag.remove(req.params.id))) throw new ApiError(404, 'Tag not found');
  logActivity(req, 'tag.delete', 'tag', req.params.id);
  res.json(successResponse(null, 'Tag deleted'));
});
