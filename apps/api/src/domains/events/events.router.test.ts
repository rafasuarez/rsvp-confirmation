import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import session from 'express-session'
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

// Bypass rate limiter so repeated logins in tests are not blocked
vi.mock('express-rate-limit', () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))

// Mock redis
vi.mock('../../config/redis.js', () => ({
  redis: {
    on: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn(),
  },
}))

// Mock BullMQ queues
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

const USER_A_ID = 'user-a-cuid'
const USER_B_ID = 'user-b-cuid'

const mockEvent = {
  id: 'event-cuid-1',
  adminUserId: USER_A_ID,
  name: 'Wedding Party',
  slug: 'wedding-party-abc123',
  eventDate: new Date('2026-06-15T18:00:00.000Z'),
  venue: 'Grand Ballroom',
  description: 'A wonderful celebration',
  isActive: true,
  waBusinessId: null,
  waPhoneNumberId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockEventB = {
  ...mockEvent,
  id: 'event-cuid-2',
  adminUserId: USER_B_ID,
  slug: 'wedding-party-xyz999',
}

// Track which events exist in the mock store
const eventStore: Map<string, typeof mockEvent> = new Map()

// Mutable store for pending guests (tests can override)
let pendingGuestsStore: Array<{
  id: string
  eventId: string
  phone: string
  name: string
  language: string
  conversationState: { state: string } | null
}> = []

vi.mock('../../config/db.js', () => {
  return {
    prisma: {
      event: {
        findMany: vi.fn(async ({ where }: { where: { adminUserId: string } }) => {
          return Array.from(eventStore.values()).filter(
            (e) => e.adminUserId === where.adminUserId,
          )
        }),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return eventStore.get(where.id) ?? null
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const newEvent = {
            id: `event-created-${Date.now()}`,
            adminUserId: data['adminUserId'] as string,
            name: data['name'] as string,
            slug: data['slug'] as string,
            eventDate: new Date(data['eventDate'] as string),
            venue: (data['venue'] as string | undefined) ?? null,
            description: (data['description'] as string | undefined) ?? null,
            isActive: true,
            waBusinessId: null,
            waPhoneNumberId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          eventStore.set(newEvent.id, newEvent)
          return newEvent
        }),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = eventStore.get(where.id)
            if (!existing) throw new Error('Not found')
            const updated = { ...existing, ...data, updatedAt: new Date() }
            eventStore.set(where.id, updated)
            return updated
          },
        ),
      },
      adminUser: {
        findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
          if (where.id === USER_A_ID || where.email === 'admin@example.com') {
            return {
              id: USER_A_ID,
              email: 'admin@example.com',
              name: 'Admin User',
              passwordHash: '$2b$10$placeholder',
            }
          }
          return null
        }),
      },
      guest: {
        findMany: vi.fn(async () => pendingGuestsStore),
      },
      message: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: `msg-${Date.now()}-${Math.random()}`,
          ...data,
          createdAt: new Date(),
        })),
      },
      conversationState: {
        upsert: vi.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => ({
          id: `cs-${Date.now()}`,
          ...create,
          ...update,
        })),
      },
    },
  }
})

let app: Express

// Helper: get an authenticated session cookie for user A
async function loginUserA(): Promise<string[]> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@example.com', password: 'Password123!' })
  return (res.headers['set-cookie'] as string[]) ?? []
}

// Patch the session directly on the app instead (inject session via middleware override)
// We need a way to inject a session without a real user/bcrypt — use a helper endpoint approach.
// Instead, mock the auth service so bcrypt.compare always returns true.
vi.mock('../../domains/auth/auth.service.js', () => ({
  verifyPassword: vi.fn().mockResolvedValue(true),
}))

beforeAll(async () => {
  // Seed mock event for user B (for 403 tests)
  eventStore.set(mockEventB.id, mockEventB)

  const { createServer } = await import('../../server.js')
  app = createServer()
})

// ─── GET / ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/events', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/events').expect(401)
    expect(res.body).toMatchObject({ success: false })
  })

  it('returns empty array when no events exist for user', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    // Clear any user-A events first
    for (const [id, ev] of eventStore.entries()) {
      if (ev.adminUserId === USER_A_ID) eventStore.delete(id)
    }

    const res = await request(app)
      .get('/api/v1/events')
      .set('Cookie', cookie)
      .expect(200)

    expect(res.body).toMatchObject({ success: true, data: [] })
  })
})

// ─── POST / ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/events', () => {
  it('returns 400 when name is missing', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    const res = await request(app)
      .post('/api/v1/events')
      .set('Cookie', cookie)
      .send({ eventDate: '2026-06-15T18:00:00.000Z' })
      .expect(400)

    expect(res.body).toMatchObject({ success: false })
  })

  it('creates event and returns 201', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    const res = await request(app)
      .post('/api/v1/events')
      .set('Cookie', cookie)
      .send({
        name: 'My Wedding',
        eventDate: '2026-06-15T18:00:00.000Z',
        venue: 'Grand Ballroom',
        description: 'A big party',
      })
      .expect(201)

    expect(res.body).toMatchObject({
      success: true,
      data: {
        name: 'My Wedding',
        venue: 'Grand Ballroom',
      },
    })
    expect(typeof res.body.data.slug).toBe('string')
    expect(res.body.data.slug).toMatch(/^my-wedding-/)
  })
})

// ─── GET /:id ─────────────────────────────────────────────────────────────────

describe('GET /api/v1/events/:id', () => {
  it('returns 404 for non-existent event', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    await request(app)
      .get('/api/v1/events/does-not-exist')
      .set('Cookie', cookie)
      .expect(404)
  })

  it("returns 403 for another user's event", async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    await request(app)
      .get(`/api/v1/events/${mockEventB.id}`)
      .set('Cookie', cookie)
      .expect(403)
  })

  it('returns 200 with event data for owner', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    // Create a user-A event first
    const createRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', cookie)
      .send({ name: 'Get Test Event', eventDate: '2026-07-01T12:00:00.000Z' })

    const eventId = createRes.body.data.id

    const res = await request(app)
      .get(`/api/v1/events/${eventId}`)
      .set('Cookie', cookie)
      .expect(200)

    expect(res.body).toMatchObject({
      success: true,
      data: { id: eventId, name: 'Get Test Event' },
    })
  })
})

// ─── PATCH /:id ───────────────────────────────────────────────────────────────

describe('PATCH /api/v1/events/:id', () => {
  it('updates event name and returns 200', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    const createRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', cookie)
      .send({ name: 'Old Name', eventDate: '2026-08-01T12:00:00.000Z' })

    const eventId = createRes.body.data.id

    const res = await request(app)
      .patch(`/api/v1/events/${eventId}`)
      .set('Cookie', cookie)
      .send({ name: 'New Name' })
      .expect(200)

    expect(res.body).toMatchObject({
      success: true,
      data: { id: eventId, name: 'New Name' },
    })
  })
})

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

describe('DELETE /api/v1/events/:id', () => {
  it('soft-deletes event (sets isActive=false) and returns 200', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    const createRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', cookie)
      .send({ name: 'To Be Deleted', eventDate: '2026-09-01T12:00:00.000Z' })

    const eventId = createRes.body.data.id

    const res = await request(app)
      .delete(`/api/v1/events/${eventId}`)
      .set('Cookie', cookie)
      .expect(200)

    expect(res.body).toMatchObject({ success: true })

    // Verify the event is soft-deleted in the store
    const storedEvent = eventStore.get(eventId)
    expect(storedEvent?.isActive).toBe(false)
  })
})

// ─── POST /:id/launch ─────────────────────────────────────────────────────────

describe('POST /api/v1/events/:id/launch', () => {
  it('queues 3 PENDING guests and returns 200 with queued: 3', async () => {
    const { outboundMessagesQueue } = await import('../../config/queues.js')
    const addSpy = vi.mocked(outboundMessagesQueue.add)
    addSpy.mockClear()

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    const createRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', cookie)
      .send({ name: 'Launch Event', eventDate: '2026-10-01T12:00:00.000Z' })

    const eventId = createRes.body.data.id

    // Seed 3 PENDING guests
    pendingGuestsStore = [
      { id: 'guest-1', eventId, phone: '+34600000001', name: 'Alice', language: 'es', conversationState: { state: 'PENDING' } },
      { id: 'guest-2', eventId, phone: '+34600000002', name: 'Bob', language: 'en', conversationState: null },
      { id: 'guest-3', eventId, phone: '+34600000003', name: 'Carol', language: 'es', conversationState: { state: 'PENDING' } },
    ]

    const res = await request(app)
      .post(`/api/v1/events/${eventId}/launch`)
      .set('Cookie', cookie)
      .expect(200)

    expect(res.body).toMatchObject({ success: true, data: { queued: 3 } })
    expect(addSpy).toHaveBeenCalledTimes(3)
  })

  it('returns 200 with queued: 0 when no PENDING guests', async () => {
    const { outboundMessagesQueue } = await import('../../config/queues.js')
    const addSpy = vi.mocked(outboundMessagesQueue.add)
    addSpy.mockClear()

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' })
    const cookie = loginRes.headers['set-cookie'] as string[]

    const createRes = await request(app)
      .post('/api/v1/events')
      .set('Cookie', cookie)
      .send({ name: 'Empty Launch Event', eventDate: '2026-11-01T12:00:00.000Z' })

    const eventId = createRes.body.data.id

    // No pending guests
    pendingGuestsStore = []

    const res = await request(app)
      .post(`/api/v1/events/${eventId}/launch`)
      .set('Cookie', cookie)
      .expect(200)

    expect(res.body).toMatchObject({ success: true, data: { queued: 0 } })
    expect(addSpy).not.toHaveBeenCalled()
  })
})
