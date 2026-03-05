/**
 * Cache utility — thin wrapper around Redis for app-level caching.
 *
 * Usage:
 *   const cache = require('./utils/cache');
 *   await cache.set('product:detail:abc123', data, 600); // 10 min TTL
 *   const data = await cache.get('product:detail:abc123');
 *   await cache.del('product:detail:abc123');
 *   await cache.invalidatePattern('product:list:*');
 *
 * Cache Key Conventions:
 *   product:list:{region}:{categoryId}:{page}    TTL: 300s (5 min)
 *   product:detail:{productId}                   TTL: 600s (10 min)
 *   product:featured:{region}                    TTL: 300s (5 min)
 *   category:tree:{region}                       TTL: 3600s (1 hr)
 *   coupon:valid:{code}                          TTL: 30s
 *   user:session:{firebaseUid}                   TTL: 900s (15 min)
 *   autopay:queue:{YYYY-MM-DD}                   TTL: 7200s (2 hr)
 */

const getRedisClient = require('../config/redis');

const cache = {
  /**
   * Get a cached value. Returns null on miss or Redis error.
   */
  async get(key) {
    try {
      const redis = getRedisClient();
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null; // Cache miss on error — falls through to DB
    }
  },

  /**
   * Set a value with TTL in seconds.
   */
  async set(key, value, ttlSeconds) {
    try {
      const redis = getRedisClient();
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch {
      // Non-fatal — app continues without caching
    }
  },

  /**
   * Delete a single key.
   */
  async del(key) {
    try {
      const redis = getRedisClient();
      await redis.del(key);
    } catch {
      // Non-fatal
    }
  },

  /**
   * Invalidate all keys matching a glob pattern.
   * Example: invalidatePattern('product:list:*')
   *
   * NOTE: KEYS is fine at current scale (< 100k keys).
   * TODO: When Redis keyspace > 100k keys — switch to SCAN-based iteration
   *       or use versioned cache key prefixes instead.
   */
  async invalidatePattern(pattern) {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch {
      // Non-fatal
    }
  },
};

module.exports = cache;
