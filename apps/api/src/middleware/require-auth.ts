import type { Request, Response, NextFunction } from 'express'
import { fail } from '@topaz-ibis/shared'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json(fail('Unauthorized'))
    return
  }
  next()
}
