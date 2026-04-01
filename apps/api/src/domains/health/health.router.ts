import { Router, type IRouter } from 'express'
import { prisma } from '../../config/db.js'
import { redis } from '../../config/redis.js'
import { ok, fail } from '@topaz-ibis/shared'

export const healthRouter: IRouter = Router()

healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const redisPing = await redis.ping()

    if (redisPing !== 'PONG') {
      res.status(503).json(fail('Redis unhealthy'))
      return
    }

    res.json(
      ok({
        status: 'ok',
        db: 'connected',
        redis: 'connected',
        timestamp: new Date().toISOString(),
      }),
    )
  } catch (err) {
    res.status(503).json(fail('Service unavailable'))
  }
})
