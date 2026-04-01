import type { Guest } from '@prisma/client'
import { prisma } from '../../config/db.js'
import type { GuestRow } from './guests.import.js'

export async function findGuestsByEvent(eventId: string): Promise<Guest[]> {
  return prisma.guest.findMany({
    where: { eventId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function importGuests(
  eventId: string,
  guests: GuestRow[],
  importBatch: string,
): Promise<{ imported: number; skipped: number }> {
  const results = await prisma.$transaction(async (tx) => {
    const importedGuests: string[] = []
    const skippedGuests: string[] = []

    for (const guest of guests) {
      const existing = await tx.guest.findUnique({
        where: { eventId_phone: { eventId, phone: guest.phone } },
      })

      if (existing !== null) {
        skippedGuests.push(guest.phone)
        continue
      }

      const created = await tx.guest.create({
        data: {
          eventId,
          phone: guest.phone,
          name: guest.name,
          email: guest.email,
          language: guest.language,
          importBatch,
        },
      })

      await Promise.all([
        tx.consentRecord.create({ data: { guestId: created.id } }),
        tx.conversationState.create({ data: { guestId: created.id } }),
        tx.rsvpResponse.create({ data: { guestId: created.id } }),
      ])

      importedGuests.push(created.id)
    }

    return {
      imported: importedGuests.length,
      skipped: skippedGuests.length,
    }
  })

  return results
}
