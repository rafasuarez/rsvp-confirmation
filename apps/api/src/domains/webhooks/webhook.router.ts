import { Router, type IRouter } from 'express'
import { env } from '../../config/env.js'
import { logger } from '../../config/logger.js'
import { ok, fail } from '@topaz-ibis/shared'
import {
  webhookVerifyQuerySchema,
  whatsappWebhookPayloadSchema,
} from './webhook.schemas.js'
import {
  validateHmacSignature,
  storeAndEnqueueWebhook,
} from './webhook.service.js'

export const webhookRouter: IRouter = Router()

// GET /webhook/whatsapp — Meta verification handshake
webhookRouter.get('/webhook/whatsapp', (req, res) => {
  const result = webhookVerifyQuerySchema.safeParse(req.query)

  if (!result.success) {
    logger.warn({ query: req.query }, 'Invalid webhook verify request')
    res.status(400).json(fail('Invalid verification request'))
    return
  }

  const { 'hub.verify_token': token, 'hub.challenge': challenge } = result.data

  if (token !== env.WA_VERIFY_TOKEN) {
    logger.warn('Webhook verify token mismatch')
    res.status(403).json(fail('Forbidden'))
    return
  }

  logger.info('WhatsApp webhook verification successful')
  res.status(200).send(challenge)
})

// POST /webhook/whatsapp — Inbound messages & status updates
// Uses express.raw() middleware (mounted in server.ts) to preserve raw body for HMAC
webhookRouter.post('/webhook/whatsapp', async (req, res) => {
  const signature = req.headers['x-hub-signature-256']

  if (typeof signature !== 'string') {
    logger.warn('Missing X-Hub-Signature-256 header')
    res.status(400).json(fail('Missing signature'))
    return
  }

  const rawBody: Buffer = req.body as Buffer

  const isValid = validateHmacSignature(rawBody, signature, env.WA_APP_SECRET)
  if (!isValid) {
    logger.warn('HMAC signature validation failed')
    res.status(403).json(fail('Invalid signature'))
    return
  }

  // Must return 200 quickly — WhatsApp will retry if we take > 30s
  res.status(200).json(ok(undefined))

  // Parse and process asynchronously
  try {
    const bodyJson = JSON.parse(rawBody.toString()) as unknown
    const result = whatsappWebhookPayloadSchema.safeParse(bodyJson)

    if (!result.success) {
      logger.warn({ err: result.error }, 'Unexpected webhook payload shape')
      return
    }

    await storeAndEnqueueWebhook(result.data, rawBody)
  } catch (err) {
    logger.error({ err }, 'Error processing webhook payload')
  }
})
