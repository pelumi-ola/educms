const { cache } = require('../config/redis');

// Read-through cache helper. Falls back to the loader when Redis is disabled.
const remember = async (key, ttl, loader) => {
  const hit = await cache.get(key);
  if (hit !== null) return hit;
  const value = await loader();
  await cache.set(key, value, ttl);
  return value;
};

module.exports = { remember, invalidate: (pattern) => cache.delPattern(pattern), cache };
