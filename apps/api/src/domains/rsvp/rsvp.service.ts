import { z } from 'zod'
import {
  getResponses,
  getStats,
  getAllForExport,
  type GuestResponseRow,
  type StatsResult,
} from './rsvp.queries.js'

export const listResponsesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v ?? '1', 10) || 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? '50', 10) || 50))),
  status: z
    .enum(['attending', 'declined', 'pending', 'opted_out'])
    .optional(),
})

export type ListResponsesQuery = z.infer<typeof listResponsesQuerySchema>

const CONVERSATION_STEP_LABELS: Record<string, string> = {
  PENDING: 'Not contacted',
  INITIAL_SENT: 'Message sent',
  AWAITING_ATTENDANCE: 'Waiting for reply',
  AWAITING_COMPANIONS: 'Waiting for companions',
  AWAITING_DIETARY: 'Waiting for dietary info',
  COMPLETE: 'Complete',
  OPT_OUT: 'Opted out',
  UNREACHABLE: 'Unreachable',
}

function escapeCSVField(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsvLine(row: GuestResponseRow): string {
  const status = CONVERSATION_STEP_LABELS[row.conversationState] ?? row.conversationState
  const attending =
    row.isAttending === true ? 'Yes' : row.isAttending === false ? 'No' : ''

  return [
    escapeCSVField(row.name),
    escapeCSVField(row.phone),
    escapeCSVField(row.email),
    escapeCSVField(status),
    escapeCSVField(attending),
    escapeCSVField(
      row.confirmedPartySize !== null ? String(row.confirmedPartySize) : null,
    ),
    escapeCSVField(row.dietaryNotes),
    escapeCSVField(row.submittedAt),
  ].join(',')
}

export async function listResponses(
  eventId: string,
  query: ListResponsesQuery,
): Promise<{ rows: GuestResponseRow[]; total: number; page: number; limit: number }> {
  const { rows, total } = await getResponses(eventId, {
    page: query.page,
    limit: query.limit,
    status: query.status,
  })

  return { rows, total, page: query.page, limit: query.limit }
}

export async function fetchStats(eventId: string): Promise<StatsResult> {
  return getStats(eventId)
}

export async function buildCsvExport(eventId: string): Promise<string> {
  const rows = await getAllForExport(eventId)

  const header = 'Name,Phone,Email,Status,Attending,Party Size,Dietary Notes,Submitted At'
  const lines = rows.map(rowToCsvLine)

  return [header, ...lines].join('\n')
}
