require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const db = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { uploadDir } = require('./middleware/upload');

const app = express();
const v = process.env.API_VERSION || 'v1';

app.set('trust proxy', 1); // behind Heroku's router
// Uploaded media is meant to be embedded by the frontend on another origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (process.env.FRONTEND_URL || '*').split(',').map((s) => s.trim()),
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: (m) => logger.info(m.trim()) } }));
}

app.use(`/api/${v}`, rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
}));
// Stricter limit on credential endpoints
app.use(`/api/${v}/auth/login`, rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' } }));

app.use('/uploads', express.static(uploadDir));

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'up', uptime: process.uptime() });
  } catch (e) {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

app.get('/', (req, res) => res.json({
  name: 'EduCMS API', version: '1.0.0', docs: 'See README.md', health: '/health',
  endpoints: ['auth', 'posts', 'categories', 'tags', 'comments', 'media', 'users', 'analytics']
    .map((e) => `/api/${v}/${e}`),
}));

app.use(`/api/${v}/auth`, require('./routes/auth'));
app.use(`/api/${v}/posts`, require('./routes/posts'));
app.use(`/api/${v}/categories`, require('./routes/categories'));
app.use(`/api/${v}/tags`, require('./routes/tags'));
app.use(`/api/${v}/comments`, require('./routes/comments'));
app.use(`/api/${v}/media`, require('./routes/media'));
app.use(`/api/${v}/users`, require('./routes/users'));
app.use(`/api/${v}/analytics`, require('./routes/analytics'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
