import { describe, it, expect } from 'vitest'
import { parseGuestCsv } from './guests.import.js'

const EVENT_ID = 'evt_test_001'
const IMPORT_BATCH = 'batch_001'

function toCsvBuffer(csv: string): Buffer {
  return Buffer.from(csv, 'utf-8')
}

describe('parseGuestCsv', () => {
  it('returns empty result for an empty CSV (headers only)', async () => {
    const csv = 'first_name,last_name,phone,email\n'
    const result = await parseGuestCsv(toCsvBuffer(csv), EVENT_ID, IMPORT_BATCH)
    expect(result).toEqual({ valid: [], invalid: [], duplicatePhones: [] })
  })

  it('parses a valid row with international phone number', async () => {
    const csv = 'first_name,last_name,phone,email\nAna,García,+34612345678,ana@example.com\n'
    const result = await parseGuestCsv(toCsvBuffer(csv), EVENT_ID, IMPORT_BATCH)

    expect(result.valid).toHaveLength(1)
    expect(result.invalid).toHaveLength(0)
    expect(result.duplicatePhones).toHaveLength(0)

    const guest = result.valid[0]!
    expect(guest.name).toBe('Ana García')
    expect(guest.phone).toBe('+34612345678')
    expect(guest.email).toBe('ana@example.com')
    expect(guest.language).toBe('es')
  })

  it('normalizes a Spanish number without country code using default ES', async () => {
    const csv = 'first_name,last_name,phone,email\nBob,Smith,612345678,\n'
    const result = await parseGuestCsv(toCsvBuffer(csv), EVENT_ID, IMPORT_BATCH)

    expect(result.valid).toHaveLength(1)
    expect(result.invalid).toHaveLength(0)

    const guest = result.valid[0]!
    expect(guest.phone).toBe('+34612345678')
  })

  it('normalizes phone numbers with spaces (e.g., +34 612 345 678)', async () => {
    const csv = 'first_name,last_name,phone,email\nAna,García,+34 612 345 678,\n'
    const result = await parseGuestCsv(toCsvBuffer(csv), EVENT_ID, IMPORT_BATCH)

    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]!.phone).toBe('+34612345678')
  })

  it('adds invalid phone to invalid array with reason "invalid phone"', async () => {
    const csv = 'first_name,last_name,phone,email\nJohn,Doe,12345,\n'
    const result = await parseGuestCsv(toCsvBuffer(csv), EVENT_ID, IMPORT_BATCH)

    expect(result.valid).toHaveLength(0)
    expect(result.invalid).toHaveLength(1)

    const invalidEntry = result.invalid[0]!
    expect(invalidEntry.row).toBe(2)
    expect(invalidEntry.rawPhone).toBe('12345')
    expect(invalidEntry.reason).toBe('invalid phone')
  })

  it('detects duplicate phones in the CSV and flags them', async () => {
    const csv = [
      'first_name,last_name,phone,email',
      'Ana,García,+34612345678,ana@example.com',
      'Ana,Duplicate,+34612345678,ana2@example.com',
    ].join('\n') + '\n'

    const result = await parseGuestCsv(toCsvBuffer(csv), EVENT_ID, IMPORT_BATCH)

    // Both rows parse to valid phone, first occurrence goes to valid
    expect(result.valid).toHaveLength(1)
    expect(result.valid[0]!.phone).toBe('+34612345678')

    // Second occurrence is flagged as duplicate
    expect(result.duplicatePhones).toHaveLength(1)
    expect(result.duplicatePhones[0]!.phone).toBe('+34612345678')
    expect(result.duplicatePhones[0]!.row).toBe(3)
  })

  it('handles multiple rows with a mix of valid and invalid phones', async () => {
    const csv = [
      'first_name,last_name,phone,email',
      'Ana,García,+34612345678,ana@example.com',
      'Bad,Phone,not-a-phone,',
      'Carlos,López,600111222,',
    ].join('\n') + '\n'

    const result = await parseGuestCsv(toCsvBuffer(csv), EVENT_ID, IMPORT_BATCH)

    expect(result.valid).toHaveLength(2)
    expect(result.invalid).toHaveLength(1)
    expect(result.invalid[0]!.row).toBe(3)
    expect(result.invalid[0]!.rawPhone).toBe('not-a-phone')
  })

  it('trims whitespace from name parts', async () => {
    const csv = 'first_name,last_name,phone,email\n  Ana , García ,+34612345678,\n'
    const result = await parseGuestCsv(toCsvBuffer(csv), EVENT_ID, IMPORT_BATCH)

    expect(result.valid[0]!.name).toBe('Ana García')
  })

  it('sets email to null when the field is empty', async () => {
    const csv = 'first_name,last_name,phone,email\nAna,García,+34612345678,\n'
    const result = await parseGuestCsv(toCsvBuffer(csv), EVENT_ID, IMPORT_BATCH)

    expect(result.valid[0]!.email).toBeNull()
  })
})
