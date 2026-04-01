import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../config/logger.js'
import { fail } from '@topaz-ibis/shared'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const message = err.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')

    res.status(400).json(fail(`Validation error: ${message}`))
    return
  }

  if (err instanceof Error) {
    logger.error(
      { err, method: req.method, url: req.url },
      'Unhandled error',
    )
  }

  const message =
    process.env['NODE_ENV'] === 'production'
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Unknown error'

  res.status(500).json(fail(message))
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(fail(`Route not found: ${req.method} ${req.path}`))
}
