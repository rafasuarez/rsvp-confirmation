import { describe, it, expect } from 'vitest'
import bcrypt from 'bcrypt'
import { verifyPassword } from './auth.service.js'

describe('verifyPassword', () => {
  it('returns true for a correct plaintext password against its bcrypt hash', async () => {
    const plain = 'password123'
    const hash = await bcrypt.hash(plain, 1)
    const result = await verifyPassword(plain, hash)
    expect(result).toBe(true)
  })

  it('returns false for a wrong password', async () => {
    const plain = 'password123'
    const hash = await bcrypt.hash(plain, 1)
    const result = await verifyPassword('wrong-password', hash)
    expect(result).toBe(false)
  })
})
