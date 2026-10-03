const fs = require('fs');
const path = require('path');
const Media = require('../models/Media');
const { uploadDir } = require('../middleware/upload');
const { paginate, getPaginationMeta, successResponse } = require('../utils/helpers');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { isStaff } = require('../middleware/auth');
const { logActivity } = require('../services/activityService');

const typeOf = (mime) => (mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'document' : 'other');

exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded (use multipart field "file")');
  const f = req.file;
  const media = await Media.create({
    filename: f.filename, original_name: f.originalname, file_path: `/uploads/${f.filename}`,
    file_type: typeOf(f.mimetype), file_size: f.size, mime_type: f.mimetype, uploaded_by: req.user.user_id,
    alt_text: req.body.alt_text, caption: req.body.caption,
  });
  logActivity(req, 'media.upload', 'media', media.media_id, f.originalname);
  res.status(201).json(successResponse(media, 'File uploaded'));
});

exports.list = asyncHandler(async (req, res) => {
  const p = paginate(req.query.page, req.query.limit);
  const filters = { type: req.query.type, uploaded_by: isStaff(req.user) ? req.query.uploaded_by : req.user.user_id };
  const { rows, total } = await Media.list(filters, p);
  res.json(successResponse({ media: rows, pagination: getPaginationMeta(total, p.page, p.limit) }));
});

const owned = async (req) => {
  const m = await Media.findById(req.params.id);
  if (!m) throw new ApiError(404, 'Media not found');
  if (!isStaff(req.user) && m.uploaded_by !== req.user.user_id) throw new ApiError(403, 'Not allowed');
  return m;
};

exports.get = asyncHandler(async (req, res) => res.json(successResponse(await owned(req))));

exports.update = asyncHandler(async (req, res) => {
  await owned(req);
  res.json(successResponse(await Media.update(req.params.id, req.body), 'Media updated'));
});

exports.remove = asyncHandler(async (req, res) => {
  const m = await owned(req);
  await Media.remove(m.media_id);
  fs.unlink(path.join(uploadDir, path.basename(m.filename)), () => {});
  logActivity(req, 'media.delete', 'media', m.media_id, m.original_name);
  res.json(successResponse(null, 'Media deleted'));
});
