import { prisma } from '../config/db.js'
import { logger } from '../config/logger.js'
import { sendTextMessage } from '../domains/whatsapp/whatsapp.service.js'

export type SendMessageJobData = {
  guestId: string
  messageId: string
  to: string
  text: string
  phoneNumberId?: string
}

export async function processOutboundMessage(
  data: SendMessageJobData,
): Promise<void> {
  const { guestId, messageId, to, text, phoneNumberId } = data

  try {
    const result = await sendTextMessage(to, text, phoneNumberId)

    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'SENT',
        waMessageId: result.messageId,
        sentAt: new Date(),
      },
    })

    logger.info(
      { guestId, messageId, waMessageId: result.messageId },
      'Outbound message sent successfully',
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    })

    logger.error(
      { guestId, messageId, errorMessage },
      'Outbound message failed to send',
    )

    throw err
  }
}
