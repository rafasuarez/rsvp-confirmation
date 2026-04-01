import { z } from 'zod'

export const GuestRowSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().nullable().default(null),
  language: z.string().default('es'),
})

export const ImportConfirmBodySchema = z.object({
  importBatch: z.string().min(1),
  guests: z.array(GuestRowSchema),
})

export type GuestRowInput = z.infer<typeof GuestRowSchema>
export type ImportConfirmBody = z.infer<typeof ImportConfirmBodySchema>
