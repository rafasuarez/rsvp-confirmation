import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { createServer } from './server.js'

async function main() {
  const app = createServer()

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      'API server started',
    )
  })

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received')
    server.close(() => {
      logger.info('HTTP server closed')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('Fatal error during startup:', err)
  process.exit(1)
})
