import crypto from 'crypto'
import { prisma } from '../../config/db.js'
import { logger } from '../../config/logger.js'
import { inboundProcessingQueue } from '../../config/queues.js'
import type {
  WhatsAppWebhookPayload,
  WhatsAppMessage,
  WhatsAppStatus,
} from './webhook.schemas.js'

export function validateHmacSignature(
  rawBody: Buffer,
  signatureHeader: string,
  appSecret: string,
): boolean {
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`

  const actualBuffer = Buffer.from(signatureHeader)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (actualBuffer.length !== expectedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}

export async function storeAndEnqueueWebhook(
  payload: WhatsAppWebhookPayload,
  rawBody: Buffer,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawJson = JSON.parse(rawBody.toString()) as any

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value

      // Handle incoming messages
      if (value.messages?.length) {
        for (const message of value.messages) {
          await storeInboundMessage(message, value, rawJson)
        }
      }

      // Handle status updates (delivered, read, failed, etc.)
      if (value.statuses?.length) {
        for (const status of value.statuses) {
          await updateMessageStatus(status)
        }
      }
    }
  }
}

async function storeInboundMessage(
  message: WhatsAppMessage,
  value: WhatsAppWebhookPayload['entry'][0]['changes'][0]['value'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawJson: any,
): Promise<void> {
  const waMessageId = message.id

  try {
    const webhookEvent = await prisma.webhookEvent.upsert({
      where: {
        source_waMessageId: {
          source: 'whatsapp',
          waMessageId,
        },
      },
      update: {},
      create: {
        source: 'whatsapp',
        waMessageId,
        type: 'messages',
        status: 'RECEIVED',
        rawPayload: rawJson,
        receivedAt: new Date(),
      },
    })

    // Skip if this was already processed (duplicate webhook)
    if (webhookEvent.status === 'DUPLICATE') {
      logger.info({ waMessageId }, 'Duplicate webhook received — skipping')
      return
    }

    // Enqueue for async processing
    await inboundProcessingQueue.add(
      'process-inbound',
      {
        webhookEventId: webhookEvent.id,
        waMessageId,
        from: message.from,
        body: message.text?.body ?? '',
        timestamp: message.timestamp,
        phoneNumberId: value.metadata.phone_number_id,
      },
      { jobId: `inbound-${waMessageId}` },
    )

    logger.info(
      { waMessageId, from: message.from },
      'Inbound message stored and enqueued',
    )
  } catch (err) {
    // Unique constraint violation = duplicate → safe to ignore
    const isUniqueViolation =
      err instanceof Error && err.message.includes('Unique constraint')

    if (isUniqueViolation) {
      logger.info({ waMessageId }, 'Duplicate webhook (constraint) — skipping')
      return
    }

    logger.error({ err, waMessageId }, 'Failed to store inbound webhook')
    throw err
  }
}

async function updateMessageStatus(status: WhatsAppStatus): Promise<void> {
  const ts = new Date(parseInt(status.timestamp, 10) * 1000)

  const updatesByWaStatus: Record<
    string,
    Parameters<typeof prisma.message.updateMany>[0]['data']
  > = {
    sent: { status: 'SENT', sentAt: ts },
    delivered: { status: 'DELIVERED', deliveredAt: ts },
    read: { status: 'READ', readAt: ts },
    failed: { status: 'FAILED' },
  }

  const data = updatesByWaStatus[status.status]
  if (!data) return

  try {
    await prisma.message.updateMany({
      where: { waMessageId: status.id },
      data,
    })
  } catch (err) {
    logger.error(
      { err, waMessageId: status.id },
      'Failed to update message status',
    )
  }
}
