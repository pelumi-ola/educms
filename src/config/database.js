const { Pool } = require('pg');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

// Heroku provides DATABASE_URL; locally we use the individual DB_* variables.
const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isProd ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME || 'educms_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    };

Object.assign(config, {
  max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 5000,
});

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

const testConnection = async () => {
  try {
    const { rows } = await pool.query('SELECT NOW() AS now');
    console.log('Database connected at:', rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

const query = (text, params) => pool.query(text, params);

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { query, pool, transaction, testConnection };
