export type NormalizedInput =
  | { intent: 'YES' }
  | { intent: 'NO' }
  | { intent: 'STOP' }
  | { intent: 'NUMBER'; value: number }
  | { intent: 'FREE_TEXT'; raw: string }

const YES_TOKENS = new Set([
  'sí', 'si', 's', 'yes', 'y', '1', 'claro', 'ok', 'vale',
  'confirmo', 'si quiero', 'sí quiero',
])

const NO_TOKENS = new Set([
  'no', 'n', '0', 'no puedo', 'no iré', 'no ire',
  'no asistire', 'no asistiré',
])

const STOP_TOKENS = new Set([
  'stop', 'para', 'baja', 'cancelar', 'no más', 'no mas', 'darme de baja',
])

export function normalizeMessage(raw: string): NormalizedInput {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()

  if (YES_TOKENS.has(lower)) {
    return { intent: 'YES' }
  }

  if (NO_TOKENS.has(lower)) {
    return { intent: 'NO' }
  }

  if (STOP_TOKENS.has(lower)) {
    return { intent: 'STOP' }
  }

  if (/^\d{1,2}$/.test(lower)) {
    const num = parseInt(lower, 10)
    if (num >= 1 && num <= 20) {
      return { intent: 'NUMBER', value: num }
    }
  }

  return { intent: 'FREE_TEXT', raw: trimmed }
}
