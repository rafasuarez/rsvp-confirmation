import { Router, type IRouter } from 'express'
import { ok, fail } from '@topaz-ibis/shared'
import { logger } from '../../config/logger.js'
import {
  listResponsesQuerySchema,
  listResponses,
  fetchStats,
  buildCsvExport,
} from './rsvp.service.js'

export const rsvpRouter: IRouter = Router({ mergeParams: true })

// GET /api/v1/events/:eventId/responses — paginated RSVP list
rsvpRouter.get('/', async (req, res) => {
  try {
    const { eventId } = req.params as { eventId: string }

    const parsed = listResponsesQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      const message = parsed.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')
      res.status(400).json(fail(`Validation error: ${message}`))
      return
    }

    const { rows, total, page, limit } = await listResponses(eventId, parsed.data)

    res.status(200).json({
      success: true,
      data: rows,
      meta: { total, page, limit },
    })
  } catch (error) {
    logger.error({ error }, 'Failed to list RSVP responses')
    res.status(500).json(fail('Failed to list RSVP responses'))
  }
})

// GET /api/v1/events/:eventId/responses/export — CSV download
rsvpRouter.get('/export', async (req, res) => {
  try {
    const { eventId } = req.params as { eventId: string }

    const csv = await buildCsvExport(eventId)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="responses-${eventId}.csv"`,
    )
    res.status(200).send(csv)
  } catch (error) {
    logger.error({ error }, 'Failed to export RSVP responses')
    res.status(500).json(fail('Failed to export RSVP responses'))
  }
})

// GET /api/v1/events/:eventId/responses/stats — aggregate counts
rsvpRouter.get('/stats', async (req, res) => {
  try {
    const { eventId } = req.params as { eventId: string }

    const stats = await fetchStats(eventId)

    res.status(200).json(ok(stats))
  } catch (error) {
    logger.error({ error }, 'Failed to fetch RSVP stats')
    res.status(500).json(fail('Failed to fetch RSVP stats'))
  }
})
