import type { Guest } from '@prisma/client'
import { parseGuestCsv, type GuestRow, type ImportPreview } from './guests.import.js'
import { findGuestsByEvent, importGuests } from './guests.queries.js'

export async function listGuests(eventId: string): Promise<Guest[]> {
  return findGuestsByEvent(eventId)
}

export async function previewCsvImport(
  csvBuffer: Buffer,
  eventId: string,
  importBatch: string,
): Promise<ImportPreview> {
  return parseGuestCsv(csvBuffer, eventId, importBatch)
}

export async function confirmCsvImport(
  eventId: string,
  guests: GuestRow[],
  importBatch: string,
): Promise<{ imported: number; skipped: number }> {
  return importGuests(eventId, guests, importBatch)
}
