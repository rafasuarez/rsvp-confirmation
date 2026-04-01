import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { Pool } from 'pg'
import { env } from './env.js'

// Augment the SessionData interface with our custom fields
declare module 'express-session' {
  interface SessionData {
    userId?: string
    userName?: string
  }
}

function buildSessionMiddleware(): ReturnType<typeof session> {
  const isTest = env.NODE_ENV === 'test'

  const store = isTest
    ? undefined // uses the default MemoryStore in test — avoids real PG connection
    : (() => {
        const PgStore = connectPgSimple(session)
        const pool = new Pool({ connectionString: env.DATABASE_URL })
        return new PgStore({ pool, tableName: 'sessions', createTableIfMissing: true })
      })()

  return session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
}

export const sessionMiddleware = buildSessionMiddleware()
