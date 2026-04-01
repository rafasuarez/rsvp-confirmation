import { z } from 'zod'

export const createEventBodySchema = z.object({
  name: z.string().min(1).max(200),
  eventDate: z.string().datetime(),
  venue: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
})

export const updateEventBodySchema = createEventBodySchema.partial()

export type CreateEventBody = z.infer<typeof createEventBodySchema>
export type UpdateEventBody = z.infer<typeof updateEventBodySchema>
