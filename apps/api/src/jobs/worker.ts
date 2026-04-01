/**
 * BullMQ Worker entry point.
 * Processes jobs from all queues.
 * Run with: node dist/jobs/worker.js
 * On Heroku: `worker` dyno runs this process independently from the web dyno.
 */
import { Worker } from 'bullmq'
import { redis } from '../config/redis.js'
import { logger } from '../config/logger.js'
import { QUEUE_NAMES } from '../config/queues.js'
import { processInboundMessage } from './process-inbound.job.js'
import { processOutboundMessage } from './send-message.job.js'

// ─── Inbound Processing Worker ────────────────────────────────────────────────
// Processes webhook events: parses message intent, runs state machine, sends reply.
const inboundWorker = new Worker(
  QUEUE_NAMES.INBOUND_PROCESSING,
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing inbound job')
    await processInboundMessage(job.data)
  },
  { connection: redis, concurrency: 5 },
)

// ─── Outbound Messages Worker ─────────────────────────────────────────────────
// Sends WhatsApp messages via Cloud API.
const outboundWorker = new Worker(
  QUEUE_NAMES.OUTBOUND_MESSAGES,
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing outbound job')
    await processOutboundMessage(job.data)
  },
  { connection: redis, concurrency: 10 },
)

// ─── Reminders Worker ─────────────────────────────────────────────────────────
const remindersWorker = new Worker(
  QUEUE_NAMES.REMINDERS,
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing reminder job')
    // Phase 2: implement in P2-1
    throw new Error('Not implemented — Phase 2')
  },
  { connection: redis, concurrency: 2 },
)

const workers = [inboundWorker, outboundWorker, remindersWorker]

workers.forEach((worker) => {
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job failed')
  })
})

logger.info('Workers started — waiting for jobs')

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Worker shutdown initiated')
  await Promise.all(workers.map((w) => w.close()))
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })
