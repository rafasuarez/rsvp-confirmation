import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters'),
  WA_VERIFY_TOKEN: z
    .string()
    .min(1, 'WA_VERIFY_TOKEN required for webhook verification'),
  WA_APP_SECRET: z
    .string()
    .min(1, 'WA_APP_SECRET required for HMAC validation'),
  WA_ACCESS_TOKEN: z
    .string()
    .min(1, 'WA_ACCESS_TOKEN required for sending messages'),
  WA_API_VERSION: z.string().default('v19.0'),
  WA_PHONE_NUMBER_ID: z.string().min(1, 'WA_PHONE_NUMBER_ID required'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
})

function parseEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')

    throw new Error(
      `Missing or invalid environment variables:\n${issues}\n\nCopy .env.example to .env and fill in the values.`,
    )
  }

  return result.data
}

export const env = parseEnv()
export type Env = typeof env
