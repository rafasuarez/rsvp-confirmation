import { Router, type IRouter } from 'express'
import rateLimit from 'express-rate-limit'
import { ok, fail } from '@topaz-ibis/shared'
import { logger } from '../../config/logger.js'
import { loginSchema } from './auth.schemas.js'
import { findAdminUserByEmail, findAdminUserById } from './auth.queries.js'
import { verifyPassword } from './auth.service.js'
import { requireAuth } from '../../middleware/require-auth.js'

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: fail('Too many login attempts, please try again later'),
})

export const authRouter: IRouter = Router()

// POST /login
authRouter.post('/login', loginRateLimiter, async (req, res) => {
  const result = loginSchema.safeParse(req.body)

  if (!result.success) {
    const message = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    res.status(400).json(fail(`Validation error: ${message}`))
    return
  }

  const { email, password } = result.data

  const user = await findAdminUserByEmail(email)

  if (!user) {
    res.status(401).json(fail('Invalid credentials'))
    return
  }

  const passwordValid = await verifyPassword(password, user.passwordHash)

  if (!passwordValid) {
    res.status(401).json(fail('Invalid credentials'))
    return
  }

  req.session.userId = user.id
  req.session.userName = user.name

  logger.info({ userId: user.id }, 'Admin user logged in')

  res.status(200).json(
    ok({ id: user.id, email: user.email, name: user.name }),
  )
})

// POST /logout
authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.warn({ err }, 'session destroy failed')
    }
  })
  res.clearCookie('connect.sid')
  res.status(200).json(ok(undefined))
})

// GET /me
authRouter.get('/me', requireAuth, async (req, res) => {
  const userId = req.session.userId as string

  const user = await findAdminUserById(userId)

  if (!user) {
    logger.warn({ userId }, 'Session references non-existent user')
    req.session.destroy(() => undefined)
    res.status(401).json(fail('Unauthorized'))
    return
  }

  res.status(200).json(
    ok({ id: user.id, email: user.email, name: user.name }),
  )
})
