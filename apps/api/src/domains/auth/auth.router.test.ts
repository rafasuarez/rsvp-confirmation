import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import session from 'express-session'
import bcrypt from 'bcrypt'
import type { Express } from 'express'

// Mock express-session config to use in-memory store (no pg dependency)
vi.mock('../../config/session.js', () => ({
  sessionMiddleware: session({
    secret: 'test_secret_for_vitest_at_least_32_chars_long',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure: false },
  }),
}))

// Mock the prisma module to avoid real DB connections in tests
vi.mock('../../config/db.js', () => {
  const mockUser = {
    id: 'cuid_test_user',
    email: 'admin@example.com',
    passwordHash: '', // will be set in beforeAll
    name: 'Admin User',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return {
    prisma: {
      adminUser: {
        findUnique: vi.fn(async ({ where }: { where: { email: string } }) => {
          if (where.email === mockUser.email) return mockUser
          return null
        }),
      },
      session: {
        deleteMany: vi.fn(),
      },
    },
    __mockUser: mockUser,
  }
})

// Mock redis to avoid real Redis connections
vi.mock('../../config/redis.js', () => ({
  redis: {
    on: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn(),
  },
}))

// Mock BullMQ queues to avoid real Redis connections
vi.mock('../../config/queues.js', () => ({
  QUEUE_NAMES: {
    OUTBOUND_MESSAGES: 'outbound-messages',
    INBOUND_PROCESSING: 'inbound-processing',
    REMINDERS: 'reminders',
  },
  outboundMessagesQueue: { add: vi.fn(), close: vi.fn() },
  inboundProcessingQueue: { add: vi.fn(), close: vi.fn() },
  remindersQueue: { add: vi.fn(), close: vi.fn() },
}))

let app: Express

beforeAll(async () => {
  // Set a valid password hash on the mock user before the server starts
  const { prisma, __mockUser } = await import('../../config/db.js') as unknown as {
    prisma: { adminUser: { findUnique: ReturnType<typeof vi.fn> } }
    __mockUser: { passwordHash: string }
  }

  __mockUser.passwordHash = await bcrypt.hash('password123', 10)

  // Update the mock to return the user with the hash set
  ;(prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
    async ({ where }: { where: { email: string } }) => {
      if (where.email === 'admin@example.com') return __mockUser
      return null
    },
  )

  const { createServer } = await import('../../server.js')
  app = createServer()
})

describe('POST /api/v1/auth/login', () => {
  it('returns 200 and sets a session cookie with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' })
      .expect(200)

    expect(res.body).toMatchObject({
      success: true,
      data: {
        id: 'cuid_test_user',
        email: 'admin@example.com',
        name: 'Admin User',
      },
    })

    // A session cookie should be set
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'wrongpassword' })
      .expect(401)

    expect(res.body).toMatchObject({
      success: false,
      error: 'Invalid credentials',
    })
  })

  it('returns 401 for an unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@example.com', password: 'password123' })
      .expect(401)

    expect(res.body).toMatchObject({
      success: false,
      error: 'Invalid credentials',
    })
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 and clears the session', async () => {
    // First log in to get a session cookie
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' })

    const cookie = loginRes.headers['set-cookie'] as string[]

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(200)

    expect(res.body).toMatchObject({ success: true })
  })
})

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without a session', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .expect(401)

    expect(res.body).toMatchObject({
      success: false,
      error: 'Unauthorized',
    })
  })

  it('returns 200 with user data when authenticated', async () => {
    // Log in first to get a session
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'password123' })

    const cookie = loginRes.headers['set-cookie'] as string[]

    const { prisma, __mockUser } = await import('../../config/db.js') as unknown as {
      prisma: { adminUser: { findUnique: ReturnType<typeof vi.fn> } }
      __mockUser: { id: string; email: string; name: string; passwordHash: string }
    }

    // The /me route also calls findAdminUserByEmail (or findById) — ensure mock returns user
    ;(prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email === 'admin@example.com' || where.id === __mockUser.id) {
          return __mockUser
        }
        return null
      },
    )

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200)

    expect(res.body).toMatchObject({
      success: true,
      data: {
        id: 'cuid_test_user',
        email: 'admin@example.com',
        name: 'Admin User',
      },
    })
  })
})
