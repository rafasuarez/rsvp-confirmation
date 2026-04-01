import { z } from 'zod'

export const webhookVerifyQuerySchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string().min(1),
  'hub.challenge': z.string().min(1),
})

// WhatsApp Cloud API payload shape (minimal — we store raw)
export const whatsappContactSchema = z.object({
  profile: z.object({ name: z.string() }).optional(),
  wa_id: z.string(),
})

export const whatsappMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
})

export const whatsappStatusSchema = z.object({
  id: z.string(),
  status: z.string(),
  timestamp: z.string(),
  recipient_id: z.string(),
})

export const whatsappValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(whatsappContactSchema).optional(),
  messages: z.array(whatsappMessageSchema).optional(),
  statuses: z.array(whatsappStatusSchema).optional(),
})

export const whatsappWebhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: whatsappValueSchema,
          field: z.literal('messages'),
        }),
      ),
    }),
  ),
})

export type WhatsAppWebhookPayload = z.infer<typeof whatsappWebhookPayloadSchema>
export type WhatsAppMessage = z.infer<typeof whatsappMessageSchema>
export type WhatsAppStatus = z.infer<typeof whatsappStatusSchema>
