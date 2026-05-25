import { Redis } from 'ioredis'
import { env } from './env.js'

export const redis = new Redis(env.redisUrl, {
  connectTimeout: 3000,
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  retryStrategy(times) {
    return times > 2 ? null : Math.min(times * 200, 1000)
  },
})

redis.on('error', (error: Error) => {
  console.error('[redis]', error.message)
})

export async function ensureRedisConnected() {
  if (redis.status === 'ready') {
    return
  }

  if (redis.status === 'wait' || redis.status === 'end') {
    await redis.connect()
  }
}
