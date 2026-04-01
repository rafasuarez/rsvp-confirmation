import IORedis from 'ioredis'
import { env } from './env.js'
import { logger } from './logger.js'

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

redis.on('connect', () => {
  logger.info('Redis connected')
})

redis.on('error', (err) => {
  logger.error({ err }, 'Redis error')
})
