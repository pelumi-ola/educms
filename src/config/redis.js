const redis = require('redis');
require('dotenv').config();

let redisClient = null;

if (process.env.REDIS_ENABLED === 'true') {
  redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB, 10) || 0,
  });
  redisClient.on('ready', () => console.log('Redis client ready'));
  redisClient.on('error', (err) => console.error('Redis error:', err.message));
  redisClient.connect().catch((e) => console.error('Failed to connect to Redis:', e.message));
}

const safe = (fn, fallback) => async (...args) => {
  if (!redisClient || !redisClient.isReady) return fallback;
  try {
    return await fn(...args);
  } catch (error) {
    console.error('Redis error:', error.message);
    return fallback;
  }
};

const cache = {
  get: safe(async (key) => {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }, null),
  set: safe(async (key, value, ttl = 3600) => {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
  }, false),
  del: safe(async (key) => { await redisClient.del(key); return true; }, false),
  // SCAN instead of KEYS so it never blocks Redis
  delPattern: safe(async (pattern) => {
    for await (const key of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      await redisClient.del(key);
    }
    return true;
  }, false),
  exists: safe(async (key) => (await redisClient.exists(key)) === 1, false),
  flush: safe(async () => { await redisClient.flushDb(); return true; }, false),
};

module.exports = { redisClient, cache };
