import { processInboundConversation } from '../domains/conversations/conversations.service.js'

export type ProcessInboundJobData = {
  webhookEventId: string
  waMessageId: string
  from: string
  body: string
  timestamp: string
  phoneNumberId: string
}

export async function processInboundMessage(
  data: ProcessInboundJobData,
): Promise<void> {
  await processInboundConversation(data)
}
