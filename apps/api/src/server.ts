import express, { type Express } from 'express'
import pinoHttp from 'pino-http'
import { logger } from './config/logger.js'
import { sessionMiddleware } from './config/session.js'
import { healthRouter } from './domains/health/health.router.js'
import { webhookRouter } from './domains/webhooks/webhook.router.js'
import { authRouter } from './domains/auth/auth.router.js'
import { eventsRouter } from './domains/events/events.router.js'
import { guestsRouter } from './domains/guests/guests.router.js'
import { rsvpRouter } from './domains/rsvp/rsvp.router.js'
import { requireAuth } from './middleware/require-auth.js'
import { requireEventOwner } from './middleware/require-event-owner.js'
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

  // Session middleware (before routes)
  app.use(sessionMiddleware)

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
  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/events', requireAuth, eventsRouter)
  app.use(
    '/api/v1/events/:eventId/guests',
    requireAuth,
    requireEventOwner,
    guestsRouter,
  )
  app.use(
    '/api/v1/events/:eventId/responses',
    requireAuth,
    requireEventOwner,
    rsvpRouter,
  )

  // 404 and error handlers (must be last)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export type App = ReturnType<typeof createServer>
