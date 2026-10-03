const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ApiError } = require('./errorHandler');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const allowed = (process.env.ALLOWED_FILE_TYPES ||
  'image/jpeg,image/png,image/gif,image/webp,application/pdf').split(',').map((s) => s.trim());

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new ApiError(400, `File type not allowed: ${file.mimetype}`)),
});

module.exports = { upload, uploadDir };
