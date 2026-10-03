const logger = require('../utils/logger');
const { errorResponse } = require('../utils/helpers');

class ApiError extends Error {
  constructor(status, message, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  if (err.code === '23505') { status = 409; message = 'A record with that value already exists'; }
  else if (err.code === '23503') { status = 400; message = 'Referenced record does not exist'; }
  else if (err.code === '23514') { status = 400; message = 'Value violates a database constraint'; }
  else if (err.code === '22P02') { status = 400; message = 'Invalid input format'; }
  else if (err.name === 'MulterError') { status = 400; message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message; }
  else if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON body'; }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, { stack: err.stack });
    if (process.env.NODE_ENV === 'production') message = 'Internal server error';
  }
  res.status(status).json(errorResponse(message, err.errors));
};

module.exports = { ApiError, asyncHandler, notFound, errorHandler };
