import { logger } from '../../config/logger.js'
import { outboundMessagesQueue } from '../../config/queues.js'
import type { ProcessInboundJobData } from '../../jobs/process-inbound.job.js'
import { ConversationStep, transition } from './conversations.machine.js'
import { normalizeMessage } from './message-normalizer.js'
import { getMessage } from './default-messages.js'
import {
  getGuestWithState,
  updateConversationState,
  upsertRsvpResponse,
  revokeConsent,
  createOutboundMessage,
  markWebhookEventProcessed,
  markWebhookEventFailed,
} from './conversations.queries.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveLanguage(lang: string | null | undefined): 'es' | 'en' {
  return lang === 'en' ? 'en' : 'es'
}

function resolveCurrentStep(stateString: string | undefined): ConversationStep {
  const step = stateString as ConversationStep | undefined
  return step && Object.values(ConversationStep).includes(step)
    ? step
    : ConversationStep.PENDING
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

export async function processInboundConversation(
  data: ProcessInboundJobData,
): Promise<void> {
  const { webhookEventId, from, body, phoneNumberId } = data

  // 1. Find guest
  const guest = await getGuestWithState(from, phoneNumberId)

  if (!guest) {
    logger.warn(
      { from, phoneNumberId, webhookEventId },
      'Guest not found for inbound message',
    )
    await markWebhookEventFailed(webhookEventId, 'Guest not found')
    return
  }

  // 2. Check consent
  if (guest.consentRecord?.status === 'REVOKED') {
    logger.info(
      { guestId: guest.id, webhookEventId },
      'Inbound message from guest with revoked consent — ignoring',
    )
    await markWebhookEventProcessed(webhookEventId)
    return
  }

  // 3. Normalize input
  const normalizedInput = normalizeMessage(body)

  // 4. Determine current state
  const currentState = resolveCurrentStep(guest.conversationState?.state)

  // 5. Determine retry count
  const retryCount = guest.conversationState?.retryCount ?? 0

  // 6. Determine language
  const guestLanguage = resolveLanguage(guest.language)

  // 7. Run state machine transition
  const result = transition(currentState, normalizedInput, { retryCount, guestLanguage })

  // 8. Execute actions
  for (const action of result.actions) {
    switch (action.type) {
      case 'SEND_MESSAGE': {
        const text = getMessage(action.templateKey, guestLanguage)
        const messageId = await createOutboundMessage(guest.id, text)
        await outboundMessagesQueue.add('send-outbound', {
          guestId: guest.id,
          messageId,
          to: guest.phone,
          text,
          phoneNumberId,
        })
        break
      }

      case 'SEND_CLARIFICATION': {
        const messageId = await createOutboundMessage(guest.id, action.reason)
        await outboundMessagesQueue.add('send-outbound', {
          guestId: guest.id,
          messageId,
          to: guest.phone,
          text: action.reason,
          phoneNumberId,
        })
        break
      }

      case 'SAVE_ATTENDANCE':
        await upsertRsvpResponse(guest.id, { isAttending: action.attending })
        break

      case 'SAVE_COMPANIONS':
        await upsertRsvpResponse(guest.id, { confirmedPartySize: action.count })
        break

      case 'SAVE_DIETARY':
        await upsertRsvpResponse(guest.id, {
          dietaryNotes: action.notes,
          submittedAt: new Date(),
        })
        break

      case 'MARK_OPT_OUT':
        await revokeConsent(guest.id)
        break

      case 'MARK_COMPLETE':
        await upsertRsvpResponse(guest.id, { submittedAt: new Date() })
        break

      case 'MARK_UNREACHABLE':
        logger.info({ guestId: guest.id }, 'Guest marked as unreachable')
        break

      case 'INCREMENT_RETRY':
        // Handled below via newRetryCount calculation
        break

      default: {
        const _exhaustive: never = action
        logger.warn({ action: _exhaustive }, 'Unknown action type encountered')
      }
    }
  }

  // 9. Calculate new retry count
  const hasIncrementRetry = result.actions.some((a) => a.type === 'INCREMENT_RETRY')
  const newRetryCount = hasIncrementRetry ? retryCount + 1 : 0

  // 10. Persist new conversation state
  await updateConversationState(guest.id, {
    state: result.nextState,
    retryCount: newRetryCount,
    lastInboundAt: new Date(),
  })

  // 11. Mark webhook as processed
  await markWebhookEventProcessed(webhookEventId)
}
