import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock external dependencies before importing the service
// ---------------------------------------------------------------------------

vi.mock('../../config/db.js', () => ({
  prisma: {
    guest: { findFirst: vi.fn() },
    conversationState: { upsert: vi.fn() },
    rsvpResponse: { upsert: vi.fn() },
    consentRecord: { update: vi.fn() },
    message: { create: vi.fn() },
    webhookEvent: { update: vi.fn() },
  },
}))

vi.mock('../../config/queues.js', () => ({
  outboundMessagesQueue: {
    add: vi.fn(),
  },
  QUEUE_NAMES: {
    OUTBOUND_MESSAGES: 'outbound-messages',
  },
}))

vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { prisma } from '../../config/db.js'
import { outboundMessagesQueue } from '../../config/queues.js'
import { processInboundConversation } from './conversations.service.js'
import type { ProcessInboundJobData } from '../../jobs/process-inbound.job.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPrisma = prisma as unknown as {
  guest: { findFirst: ReturnType<typeof vi.fn> }
  conversationState: { upsert: ReturnType<typeof vi.fn> }
  rsvpResponse: { upsert: ReturnType<typeof vi.fn> }
  consentRecord: { update: ReturnType<typeof vi.fn> }
  message: { create: ReturnType<typeof vi.fn> }
  webhookEvent: { update: ReturnType<typeof vi.fn> }
}

const mockQueue = outboundMessagesQueue as unknown as {
  add: ReturnType<typeof vi.fn>
}

function makeJobData(overrides: Partial<ProcessInboundJobData> = {}): ProcessInboundJobData {
  return {
    webhookEventId: 'webhook-1',
    waMessageId: 'wamid-1',
    from: '+34600000001',
    body: 'sí',
    timestamp: '1700000000',
    phoneNumberId: 'phone-number-id-1',
    ...overrides,
  }
}

function makeGuest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'guest-1',
    phone: '+34600000001',
    name: 'Ana García',
    language: 'es',
    event: { waPhoneNumberId: 'phone-number-id-1' },
    consentRecord: { status: 'GRANTED', revokedAt: null },
    conversationState: {
      state: 'INITIAL_SENT',
      retryCount: 0,
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: message create returns an id
  mockPrisma.message.create.mockResolvedValue({ id: 'msg-1' })
  mockPrisma.webhookEvent.update.mockResolvedValue({})
  mockPrisma.conversationState.upsert.mockResolvedValue({})
  mockPrisma.rsvpResponse.upsert.mockResolvedValue({})
  mockPrisma.consentRecord.update.mockResolvedValue({})
  mockQueue.add.mockResolvedValue({})
})

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

describe('processInboundConversation', () => {
  // ── Test 1 ──────────────────────────────────────────────────────────────
  describe('guest not found', () => {
    it('logs a warning, marks webhook FAILED, and returns without updating state', async () => {
      mockPrisma.guest.findFirst.mockResolvedValue(null)

      await processInboundConversation(makeJobData())

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'webhook-1' },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      )
      expect(mockPrisma.conversationState.upsert).not.toHaveBeenCalled()
    })
  })

  // ── Test 2 ──────────────────────────────────────────────────────────────
  describe('consent REVOKED', () => {
    it('marks webhook PROCESSED and returns without updating conversation state', async () => {
      mockPrisma.guest.findFirst.mockResolvedValue(
        makeGuest({ consentRecord: { status: 'REVOKED', revokedAt: new Date() } }),
      )

      await processInboundConversation(makeJobData())

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'webhook-1' },
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      )
      expect(mockPrisma.conversationState.upsert).not.toHaveBeenCalled()
    })
  })

  // ── Test 3 ──────────────────────────────────────────────────────────────
  describe('INITIAL_SENT + YES reply', () => {
    it('advances state to AWAITING_ATTENDANCE and enqueues an outbound message', async () => {
      mockPrisma.guest.findFirst.mockResolvedValue(
        makeGuest({ conversationState: { state: 'INITIAL_SENT', retryCount: 0 } }),
      )

      await processInboundConversation(makeJobData({ body: 'sí' }))

      // State updated to AWAITING_ATTENDANCE
      expect(mockPrisma.conversationState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ state: 'AWAITING_ATTENDANCE' }),
        }),
      )

      // Message created and queued
      expect(mockPrisma.message.create).toHaveBeenCalled()
      expect(mockQueue.add).toHaveBeenCalled()
    })
  })

  // ── Test 4 ──────────────────────────────────────────────────────────────
  describe('AWAITING_ATTENDANCE + NO reply', () => {
    it('sets state = COMPLETE, saves attendance as false, and enqueues a message', async () => {
      mockPrisma.guest.findFirst.mockResolvedValue(
        makeGuest({ conversationState: { state: 'AWAITING_ATTENDANCE', retryCount: 0 } }),
      )

      await processInboundConversation(makeJobData({ body: 'no' }))

      // SAVE_ATTENDANCE(false)
      expect(mockPrisma.rsvpResponse.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ isAttending: false }),
        }),
      )

      // State = COMPLETE
      expect(mockPrisma.conversationState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ state: 'COMPLETE' }),
        }),
      )

      // Outbound message queued
      expect(mockQueue.add).toHaveBeenCalled()
    })
  })

  // ── Test 5 ──────────────────────────────────────────────────────────────
  describe('guest replies STOP', () => {
    it('revokes consent and sets state = OPT_OUT', async () => {
      mockPrisma.guest.findFirst.mockResolvedValue(
        makeGuest({ conversationState: { state: 'INITIAL_SENT', retryCount: 0 } }),
      )

      await processInboundConversation(makeJobData({ body: 'stop' }))

      // Consent revoked
      expect(mockPrisma.consentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guestId: 'guest-1' },
          data: expect.objectContaining({ status: 'REVOKED' }),
        }),
      )

      // State = OPT_OUT
      expect(mockPrisma.conversationState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ state: 'OPT_OUT' }),
        }),
      )
    })
  })

  // ── Test 6 ──────────────────────────────────────────────────────────────
  describe('AWAITING_COMPANIONS + NUMBER reply "2"', () => {
    it('calls SAVE_COMPANIONS(2) and advances state to AWAITING_DIETARY', async () => {
      mockPrisma.guest.findFirst.mockResolvedValue(
        makeGuest({ conversationState: { state: 'AWAITING_COMPANIONS', retryCount: 0 } }),
      )

      await processInboundConversation(makeJobData({ body: '2' }))

      // SAVE_COMPANIONS(2)
      expect(mockPrisma.rsvpResponse.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ confirmedPartySize: 2 }),
        }),
      )

      // State = AWAITING_DIETARY
      expect(mockPrisma.conversationState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ state: 'AWAITING_DIETARY' }),
        }),
      )
    })
  })

  // ── Test 7 ──────────────────────────────────────────────────────────────
  describe('AWAITING_DIETARY + FREE_TEXT "sin gluten"', () => {
    it('calls SAVE_DIETARY("sin gluten") and advances state to COMPLETE', async () => {
      mockPrisma.guest.findFirst.mockResolvedValue(
        makeGuest({ conversationState: { state: 'AWAITING_DIETARY', retryCount: 0 } }),
      )

      await processInboundConversation(makeJobData({ body: 'sin gluten' }))

      // SAVE_DIETARY
      expect(mockPrisma.rsvpResponse.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ dietaryNotes: 'sin gluten' }),
        }),
      )

      // State = COMPLETE
      expect(mockPrisma.conversationState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ state: 'COMPLETE' }),
        }),
      )
    })
  })
})
