import { randomBytes } from 'crypto'
import type { Event } from '@prisma/client'
import type { CreateEventBody, UpdateEventBody } from './events.schemas.js'
import {
  findEventsByUser,
  findEventById,
  createEvent as createEventQuery,
  updateEvent,
  deactivateEvent,
  findPendingGuests,
} from './events.queries.js'
import { getMessage } from '../conversations/default-messages.js'
import { prisma } from '../../config/db.js'
import { outboundMessagesQueue } from '../../config/queues.js'
import { env } from '../../config/env.js'

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')

  const suffix = randomBytes(3).toString('hex')
  return `${base}-${suffix}`
}

export async function listEvents(adminUserId: string): Promise<Event[]> {
  return findEventsByUser(adminUserId)
}

export async function getEvent(id: string): Promise<Event | null> {
  return findEventById(id)
}

export async function createEvent(
  adminUserId: string,
  body: CreateEventBody,
): Promise<Event> {
  const slug = generateSlug(body.name)
  return createEventQuery({
    adminUserId,
    name: body.name,
    slug,
    eventDate: new Date(body.eventDate),
    venue: body.venue,
    description: body.description,
  })
}

export async function updateEventDetails(
  id: string,
  body: UpdateEventBody,
): Promise<Event> {
  const data: Partial<{
    name: string
    eventDate: Date
    venue: string
    description: string
  }> = {}

  if (body.name !== undefined) data.name = body.name
  if (body.eventDate !== undefined) data.eventDate = new Date(body.eventDate)
  if (body.venue !== undefined) data.venue = body.venue
  if (body.description !== undefined) data.description = body.description

  return updateEvent(id, data)
}

export async function softDeleteEvent(id: string): Promise<Event> {
  return deactivateEvent(id)
}

export async function launchCampaign(
  eventId: string,
  event: { waPhoneNumberId?: string | null },
): Promise<{ queued: number }> {
  const guests = await findPendingGuests(eventId)

  if (guests.length === 0) {
    return { queued: 0 }
  }

  const phoneNumberId = event.waPhoneNumberId ?? env.WA_PHONE_NUMBER_ID

  await Promise.all(
    guests.map(async (guest) => {
      const language = (guest.language === 'en' ? 'en' : 'es') as 'es' | 'en'
      const text = getMessage('ask_attendance', language)

      const message = await prisma.message.create({
        data: {
          guestId: guest.id,
          direction: 'OUTBOUND',
          content: text,
          status: 'QUEUED',
        },
      })

      await prisma.conversationState.upsert({
        where: { guestId: guest.id },
        create: { guestId: guest.id, state: 'INITIAL_SENT' },
        update: { state: 'INITIAL_SENT' },
      })

      await outboundMessagesQueue.add('send-message', {
        guestId: guest.id,
        messageId: message.id,
        to: guest.phone,
        text,
        phoneNumberId,
      })
    }),
  )

  return { queued: guests.length }
}
