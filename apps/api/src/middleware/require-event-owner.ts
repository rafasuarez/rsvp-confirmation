import type { Request, Response, NextFunction } from 'express'
import type { Event } from '@prisma/client'
import { fail } from '@topaz-ibis/shared'
import { findEventById } from '../domains/events/events.queries.js'

// Module augmentation so req.event is typed
declare global {
  namespace Express {
    interface Request {
      event?: Event
    }
  }
}

export async function requireEventOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { eventId } = req.params

  const event = await findEventById(eventId)

  if (!event) {
    res.status(404).json(fail('Event not found'))
    return
  }

  if (event.adminUserId !== req.session.userId) {
    res.status(403).json(fail('Forbidden'))
    return
  }

  req.event = event
  next()
}
