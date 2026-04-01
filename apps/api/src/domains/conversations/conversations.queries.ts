import { prisma } from '../../config/db.js'
import type { ConversationStep } from './conversations.machine.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuestWithState = {
  id: string
  phone: string
  name: string
  language: string
  event: {
    waPhoneNumberId: string | null
  }
  consentRecord: {
    status: string
    revokedAt: Date | null
  } | null
  conversationState: {
    state: string
    retryCount: number
  } | null
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getGuestWithState(
  phone: string,
  phoneNumberId: string,
): Promise<GuestWithState | null> {
  return prisma.guest.findFirst({
    where: {
      phone,
      event: { waPhoneNumberId: phoneNumberId },
    },
    include: {
      conversationState: true,
      consentRecord: true,
      event: true,
    },
  })
}

export async function updateConversationState(
  guestId: string,
  update: {
    state?: ConversationStep
    retryCount?: number
    lastInboundAt?: Date
    lastMessageAt?: Date
  },
): Promise<void> {
  await prisma.conversationState.upsert({
    where: { guestId },
    create: {
      guestId,
      state: update.state ?? 'PENDING',
      retryCount: update.retryCount ?? 0,
      lastInboundAt: update.lastInboundAt,
      lastMessageAt: update.lastMessageAt,
    },
    update,
  })
}

export async function upsertRsvpResponse(
  guestId: string,
  update: {
    isAttending?: boolean | null
    confirmedPartySize?: number | null
    dietaryNotes?: string | null
    submittedAt?: Date | null
  },
): Promise<void> {
  await prisma.rsvpResponse.upsert({
    where: { guestId },
    create: { guestId, ...update },
    update,
  })
}

export async function revokeConsent(guestId: string): Promise<void> {
  await prisma.consentRecord.update({
    where: { guestId },
    data: { status: 'REVOKED', revokedAt: new Date() },
  })
}

export async function createOutboundMessage(
  guestId: string,
  content: string,
): Promise<string> {
  const message = await prisma.message.create({
    data: {
      guestId,
      content,
      direction: 'OUTBOUND',
      status: 'QUEUED',
    },
  })
  return message.id
}

export async function markWebhookEventProcessed(
  webhookEventId: string,
): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: 'PROCESSED', processedAt: new Date() },
  })
}

export async function markWebhookEventFailed(
  webhookEventId: string,
  error: string,
): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: 'FAILED', processingError: error },
  })
}
