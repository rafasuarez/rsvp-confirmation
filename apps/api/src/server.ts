import express, { type Express } from 'express'
import pinoHttp from 'pino-http'
import { logger } from './config/logger.js'
import { healthRouter } from './domains/health/health.router.js'
import { webhookRouter } from './domains/webhooks/webhook.router.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'

export function createServer(): Express {
  const app = express()

  // Trust Heroku's reverse proxy
  app.set('trust proxy', 1)

  // HTTP request logging
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    }),
  )

  // Raw body for webhook HMAC validation (must come before json middleware)
  app.use(
    '/webhook/whatsapp',
    express.raw({ type: 'application/json', limit: '1mb' }),
  )

  // JSON body parser for all other routes
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  // Routes
  app.use('/', healthRouter)
  app.use('/api/v1', webhookRouter)

  // 404 and error handlers (must be last)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export type App = ReturnType<typeof createServer>
