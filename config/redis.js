const Redis = require('ioredis');

let redis;

function getRedisClient() {
  if (redis) return redis;

  redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    // Retry with exponential backoff, cap at 2s
    retryStrategy: (times) => Math.min(times * 50, 2000),
    // If Redis is down, don't crash the app — just log and continue
    lazyConnect: true,
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redis.on('error', (err) => {
    // Log but don't throw — app continues without cache if Redis is unavailable
    console.error('❌ Redis error:', err.message);
  });

  return redis;
}

module.exports = getRedisClient;
