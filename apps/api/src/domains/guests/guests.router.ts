import multer from 'multer'
import { Router, type IRouter } from 'express'
import { ok, fail } from '@topaz-ibis/shared'
import { logger } from '../../config/logger.js'
import { ImportConfirmBodySchema } from './guests.schemas.js'
import { listGuests, previewCsvImport, confirmCsvImport } from './guests.service.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

export const guestsRouter: IRouter = Router({ mergeParams: true })

// GET / — list guests for an event
guestsRouter.get('/', async (req, res) => {
  try {
    const { eventId } = req.params as { eventId: string }
    const guests = await listGuests(eventId)
    res.status(200).json(ok(guests))
  } catch (error) {
    logger.error({ error }, 'Failed to list guests')
    res.status(500).json(fail('Failed to list guests'))
  }
})

// POST /import — preview CSV (no DB write)
guestsRouter.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json(fail('No file uploaded'))
      return
    }

    const { eventId } = req.params as { eventId: string }
    const importBatch = new Date().toISOString()

    const preview = await previewCsvImport(req.file.buffer, eventId, importBatch)
    res.status(200).json(ok({ ...preview, importBatch }))
  } catch (error) {
    logger.error({ error }, 'Failed to preview CSV import')
    res.status(500).json(fail('Failed to process CSV file'))
  }
})

// POST /import/confirm — commit import to DB
guestsRouter.post('/import/confirm', async (req, res) => {
  try {
    const result = ImportConfirmBodySchema.safeParse(req.body)

    if (!result.success) {
      const message = result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')
      res.status(400).json(fail(`Validation error: ${message}`))
      return
    }

    const { eventId } = req.params as { eventId: string }
    const { importBatch, guests } = result.data

    const summary = await confirmCsvImport(eventId, guests, importBatch)

    logger.info({ eventId, importBatch, ...summary }, 'Guest import confirmed')
    res.status(200).json(ok(summary))
  } catch (error) {
    logger.error({ error }, 'Failed to confirm guest import')
    res.status(500).json(fail('Failed to import guests'))
  }
})
