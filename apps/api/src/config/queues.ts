import { Queue } from 'bullmq'
import { redis } from './redis.js'

export const QUEUE_NAMES = {
  OUTBOUND_MESSAGES: 'outbound-messages',
  INBOUND_PROCESSING: 'inbound-processing',
  REMINDERS: 'reminders',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

const defaultJobOptions = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
}

export const outboundMessagesQueue = new Queue(
  QUEUE_NAMES.OUTBOUND_MESSAGES,
  { connection: redis, defaultJobOptions },
)

export const inboundProcessingQueue = new Queue(
  QUEUE_NAMES.INBOUND_PROCESSING,
  { connection: redis, defaultJobOptions },
)

export const remindersQueue = new Queue(
  QUEUE_NAMES.REMINDERS,
  { connection: redis, defaultJobOptions },
)
