import { Router, type IRouter } from 'express'
import { ok, fail } from '@topaz-ibis/shared'
import { logger } from '../../config/logger.js'
import { requireEventOwner } from '../../middleware/require-event-owner.js'
import { createEventBodySchema, updateEventBodySchema } from './events.schemas.js'
import {
  listEvents,
  createEvent,
  updateEventDetails,
  softDeleteEvent,
  launchCampaign,
} from './events.service.js'

export const eventsRouter: IRouter = Router()

// GET / — list events for authenticated user
eventsRouter.get('/', async (req, res) => {
  const adminUserId = req.session.userId as string
  const events = await listEvents(adminUserId)
  res.status(200).json(ok(events))
})

// POST / — create event
eventsRouter.post('/', async (req, res) => {
  const result = createEventBodySchema.safeParse(req.body)

  if (!result.success) {
    const message = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    res.status(400).json(fail(`Validation error: ${message}`))
    return
  }

  const adminUserId = req.session.userId as string
  const event = await createEvent(adminUserId, result.data)

  logger.info({ eventId: event.id, adminUserId }, 'Event created')
  res.status(201).json(ok(event))
})

// GET /:eventId — get event by id
eventsRouter.get('/:eventId', requireEventOwner, (req, res) => {
  res.status(200).json(ok(req.event))
})

// PATCH /:eventId — update event
eventsRouter.patch('/:eventId', requireEventOwner, async (req, res) => {
  const result = updateEventBodySchema.safeParse(req.body)

  if (!result.success) {
    const message = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    res.status(400).json(fail(`Validation error: ${message}`))
    return
  }

  const eventId = req.params['eventId'] as string
  const updated = await updateEventDetails(eventId, result.data)

  logger.info({ eventId }, 'Event updated')
  res.status(200).json(ok(updated))
})

// DELETE /:eventId — soft-delete event
eventsRouter.delete('/:eventId', requireEventOwner, async (req, res) => {
  const eventId = req.params['eventId'] as string
  await softDeleteEvent(eventId)

  logger.info({ eventId }, 'Event deactivated')
  res.status(200).json(ok(undefined))
})

// POST /:eventId/launch — launch RSVP campaign for all PENDING guests
eventsRouter.post('/:eventId/launch', requireEventOwner, async (req, res) => {
  const eventId = req.params['eventId'] as string
  const event = req.event!

  const result = await launchCampaign(eventId, event)

  logger.info({ eventId, queued: result.queued }, 'Campaign launched')
  res.status(200).json(ok(result))
})
