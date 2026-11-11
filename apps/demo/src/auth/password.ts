import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, 64)

  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [algorithm, salt, key] = hash.split('$')

  if (algorithm !== 'scrypt' || !salt || !key) {
    return false
  }

  const expected = Buffer.from(key, 'hex')
  const actual = await scrypt(password, Buffer.from(salt, 'hex'), expected.length)

  return timingSafeEqual(actual, expected)
}
