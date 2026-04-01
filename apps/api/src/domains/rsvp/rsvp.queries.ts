import { ConversationStep } from '@prisma/client'
import { prisma } from '../../config/db.js'

export type GuestResponseRow = {
  guestId: string
  name: string
  phone: string
  email: string | null
  conversationState: string
  isAttending: boolean | null
  confirmedPartySize: number | null
  dietaryNotes: string | null
  submittedAt: string | null
}

export type StatsResult = {
  total: number
  attending: number
  declined: number
  pending: number
  optedOut: number
  unreachable: number
  complete: number
}

const STATUS_TO_STATES: Record<string, ConversationStep[]> = {
  attending: [ConversationStep.COMPLETE],
  declined: [ConversationStep.COMPLETE],
  pending: [
    ConversationStep.PENDING,
    ConversationStep.INITIAL_SENT,
    ConversationStep.AWAITING_ATTENDANCE,
    ConversationStep.AWAITING_COMPANIONS,
    ConversationStep.AWAITING_DIETARY,
  ],
  opted_out: [ConversationStep.OPT_OUT],
}

function buildStateFilter(status?: string): { state?: { in: ConversationStep[] } } {
  if (!status || !(status in STATUS_TO_STATES)) return {}
  return { state: { in: STATUS_TO_STATES[status] } }
}

function buildAttendingFilter(
  status?: string,
): { isAttending?: boolean | null } {
  if (status === 'attending') return { isAttending: true }
  if (status === 'declined') return { isAttending: false }
  return {}
}

function toRow(guest: {
  id: string
  name: string
  phone: string
  email: string | null
  conversationState: { state: ConversationStep } | null
  rsvpResponse: {
    isAttending: boolean | null
    confirmedPartySize: number | null
    dietaryNotes: string | null
    submittedAt: Date | null
  } | null
}): GuestResponseRow {
  return {
    guestId: guest.id,
    name: guest.name,
    phone: guest.phone,
    email: guest.email,
    conversationState: guest.conversationState?.state ?? ConversationStep.PENDING,
    isAttending: guest.rsvpResponse?.isAttending ?? null,
    confirmedPartySize: guest.rsvpResponse?.confirmedPartySize ?? null,
    dietaryNotes: guest.rsvpResponse?.dietaryNotes ?? null,
    submittedAt: guest.rsvpResponse?.submittedAt?.toISOString() ?? null,
  }
}

export async function getResponses(
  eventId: string,
  options: { page: number; limit: number; status?: string },
): Promise<{ rows: GuestResponseRow[]; total: number }> {
  const stateFilter = buildStateFilter(options.status)
  const attendingFilter = buildAttendingFilter(options.status)

  const where = {
    eventId,
    ...(Object.keys(stateFilter).length > 0
      ? { conversationState: stateFilter }
      : {}),
    ...(Object.keys(attendingFilter).length > 0
      ? { rsvpResponse: attendingFilter }
      : {}),
  }

  const [guests, total] = await Promise.all([
    prisma.guest.findMany({
      where,
      include: {
        conversationState: { select: { state: true } },
        rsvpResponse: {
          select: {
            isAttending: true,
            confirmedPartySize: true,
            dietaryNotes: true,
            submittedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    }),
    prisma.guest.count({ where }),
  ])

  return { rows: guests.map(toRow), total }
}

export async function getStats(eventId: string): Promise<StatsResult> {
  const [total, complete, optedOut, unreachable, pendingStates, attending] =
    await Promise.all([
      prisma.guest.count({ where: { eventId } }),
      prisma.guest.count({
        where: { eventId, conversationState: { state: ConversationStep.COMPLETE } },
      }),
      prisma.guest.count({
        where: { eventId, conversationState: { state: ConversationStep.OPT_OUT } },
      }),
      prisma.guest.count({
        where: {
          eventId,
          conversationState: { state: ConversationStep.UNREACHABLE },
        },
      }),
      prisma.guest.count({
        where: {
          eventId,
          conversationState: {
            state: {
              in: [
                ConversationStep.PENDING,
                ConversationStep.INITIAL_SENT,
                ConversationStep.AWAITING_ATTENDANCE,
                ConversationStep.AWAITING_COMPANIONS,
                ConversationStep.AWAITING_DIETARY,
              ],
            },
          },
        },
      }),
      prisma.guest.count({
        where: {
          eventId,
          conversationState: { state: ConversationStep.COMPLETE },
          rsvpResponse: { isAttending: true },
        },
      }),
    ])

  const declined = complete - attending

  return {
    total,
    attending,
    declined,
    pending: pendingStates,
    optedOut,
    unreachable,
    complete,
  }
}

export async function getAllForExport(eventId: string): Promise<GuestResponseRow[]> {
  const guests = await prisma.guest.findMany({
    where: { eventId },
    include: {
      conversationState: { select: { state: true } },
      rsvpResponse: {
        select: {
          isAttending: true,
          confirmedPartySize: true,
          dietaryNotes: true,
          submittedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return guests.map(toRow)
}
