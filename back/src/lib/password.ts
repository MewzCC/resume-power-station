import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)
const keyLength = 64

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedKey] = passwordHash.split('$')

  if (algorithm !== 'scrypt' || !salt || !storedKey) {
    return false
  }

  const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer
  const storedBuffer = Buffer.from(storedKey, 'hex')

  return storedBuffer.length === derivedKey.length && crypto.timingSafeEqual(storedBuffer, derivedKey)
}
