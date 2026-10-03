require('dotenv').config();
const app = require('./src/app');
const { testConnection, pool } = require('./src/config/database');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

(async () => {
  if (!(await testConnection())) logger.warn('Starting without a database connection; /health will report degraded.');
  const server = app.listen(PORT, () => logger.info(`EduCMS API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`));

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => { await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
})();
