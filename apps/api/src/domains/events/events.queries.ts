import type { Event, Guest, ConversationState } from '@prisma/client'
import { prisma } from '../../config/db.js'

export type GuestWithConversationState = Guest & {
  conversationState: ConversationState | null
}

export async function findEventsByUser(adminUserId: string): Promise<Event[]> {
  return prisma.event.findMany({ where: { adminUserId } })
}

export async function findEventById(id: string): Promise<Event | null> {
  return prisma.event.findUnique({ where: { id } })
}

export async function createEvent(data: {
  adminUserId: string
  name: string
  slug: string
  eventDate: Date
  venue?: string
  description?: string
}): Promise<Event> {
  return prisma.event.create({ data })
}

export async function updateEvent(
  id: string,
  data: Partial<{
    name: string
    eventDate: Date
    venue: string
    description: string
  }>,
): Promise<Event> {
  return prisma.event.update({ where: { id }, data })
}

export async function deactivateEvent(id: string): Promise<Event> {
  return prisma.event.update({ where: { id }, data: { isActive: false } })
}

export async function findPendingGuests(eventId: string): Promise<GuestWithConversationState[]> {
  return prisma.guest.findMany({
    where: {
      eventId,
      OR: [
        { conversationState: null },
        { conversationState: { state: 'PENDING' } },
      ],
    },
    include: { conversationState: true },
  })
}
