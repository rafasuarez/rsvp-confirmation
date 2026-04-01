import { parse } from 'csv-parse/sync'
import { parsePhoneNumberWithError } from 'libphonenumber-js'

export type GuestRow = {
  name: string
  phone: string
  email: string | null
  language: string
}

export type ImportPreview = {
  valid: GuestRow[]
  invalid: { row: number; rawPhone: string; reason: string }[]
  duplicatePhones: { row: number; phone: string }[]
}

type CsvRecord = {
  first_name: string
  last_name: string
  phone: string
  email: string
}

function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const parsed = parsePhoneNumberWithError(trimmed, 'ES')
    if (!parsed.isValid()) return null
    return parsed.format('E.164')
  } catch {
    return null
  }
}

export async function parseGuestCsv(
  csvBuffer: Buffer,
  _eventId: string,
  _importBatch: string,
): Promise<ImportPreview> {
  const records: CsvRecord[] = parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  const seen = new Map<string, number>()
  const valid: GuestRow[] = []
  const invalid: { row: number; rawPhone: string; reason: string }[] = []
  const duplicatePhones: { row: number; phone: string }[] = []

  records.forEach((record, index) => {
    const rowNumber = index + 2 // 1-based, offset by header row
    const rawPhone = record.phone ?? ''
    const firstName = (record.first_name ?? '').trim()
    const lastName = (record.last_name ?? '').trim()
    const name = [firstName, lastName].filter(Boolean).join(' ')
    const emailRaw = (record.email ?? '').trim()
    const email = emailRaw.length > 0 ? emailRaw : null

    const e164 = normalizePhone(rawPhone)

    if (e164 === null) {
      invalid.push({ row: rowNumber, rawPhone, reason: 'invalid phone' })
      return
    }

    if (seen.has(e164)) {
      duplicatePhones.push({ row: rowNumber, phone: e164 })
      return
    }

    seen.set(e164, rowNumber)
    valid.push({ name, phone: e164, email, language: 'es' })
  })

  return { valid, invalid, duplicatePhones }
}
