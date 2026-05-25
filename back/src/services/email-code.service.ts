import crypto from 'node:crypto'
import nodemailer from 'nodemailer'
import { sha256 } from '../lib/crypto.js'
import { env } from '../lib/env.js'
import { prisma } from '../lib/prisma.js'
import { ensureRedisConnected, redis } from '../lib/redis.js'

export type EmailCodeScene = 'login' | 'register' | 'resetPassword'

type StoredEmailCode = {
  codeHash: string
  attempts: number
}

type SendEmailCodeResult = {
  expiresIn: number
  resendAfter: number
}

type RequestEmailCodeContext = {
  clientIp?: string
}

export class EmailCodeError extends Error {
  code:
    | 'EMAIL_ALREADY_EXISTS'
    | 'EMAIL_NOT_REGISTERED'
    | 'EMAIL_CODE_INVALID'
    | 'EMAIL_CODE_EXPIRED'
    | 'EMAIL_CODE_TOO_FREQUENT'
    | 'EMAIL_CODE_SEND_FAILED'

  constructor(code: EmailCodeError['code'], message: string) {
    super(message)
    this.code = code
  }
}

function createCode() {
  return crypto.randomInt(100000, 1000000).toString()
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function codeKey(email: string, scene: EmailCodeScene) {
  return `email-code:${scene}:${email}`
}

function cooldownKey(email: string, scene: EmailCodeScene) {
  return `email-code-cooldown:${scene}:${email}`
}

function emailHourlyLimitKey(email: string, scene: EmailCodeScene) {
  return `email-code-limit:email:${scene}:${email}`
}

function ipHourlyLimitKey(clientIp: string, scene: EmailCodeScene) {
  return `email-code-limit:ip:${scene}:${sha256(clientIp)}`
}

function hashCode(email: string, scene: EmailCodeScene, code: string) {
  return sha256(`${scene}:${normalizeEmail(email)}:${code}`)
}

function hasSmtpConfig() {
  return Boolean(env.smtpHost)
}

async function sendCodeEmail(email: string, code: string, scene: EmailCodeScene) {
  if (!hasSmtpConfig()) {
    console.info(`[email-code] ${scene} ${email}: ${code}`)
    return false
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure || env.smtpPort === 465,
    auth: env.smtpUser
      ? {
          user: env.smtpUser,
          pass: env.smtpPass,
        }
      : undefined,
  })

  const title = scene === 'register'
    ? '简历发电站注册验证码'
    : scene === 'resetPassword'
      ? '简历发电站找回密码验证码'
      : '简历发电站登录验证码'
  const minutes = Math.max(1, Math.ceil(env.emailCodeExpiresSeconds / 60))

  await transporter.sendMail({
    from: env.smtpFrom,
    to: email,
    subject: title,
    text: `你的验证码是 ${code}，${minutes} 分钟内有效。若非本人操作，请忽略本邮件。`,
    html: [
      '<div style="font-family:Arial,sans-serif;line-height:1.7;color:#111827">',
      `<p>${title}</p>`,
      `<p>你的验证码是 <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p>`,
      `<p>${minutes} 分钟内有效。若非本人操作，请忽略本邮件。</p>`,
      '</div>',
    ].join(''),
  })

  return true
}

function parseStoredCode(value: string | null): StoredEmailCode | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredEmailCode>
    if (typeof parsed.codeHash !== 'string' || typeof parsed.attempts !== 'number') {
      return null
    }
    return {
      codeHash: parsed.codeHash,
      attempts: parsed.attempts,
    }
  } catch {
    return null
  }
}

async function assertHourlyLimit(key: string, maxCount: number) {
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, 60 * 60)
  }

  if (count > maxCount) {
    throw new EmailCodeError('EMAIL_CODE_TOO_FREQUENT', '验证码请求太频繁，请稍后再试')
  }
}

export async function requestEmailCode(
  emailInput: string,
  scene: EmailCodeScene,
  context: RequestEmailCodeContext = {},
): Promise<SendEmailCodeResult> {
  const email = normalizeEmail(emailInput)
  const user = await prisma.user.findUnique({ where: { email } })

  if (scene === 'register' && user) {
    throw new EmailCodeError('EMAIL_ALREADY_EXISTS', '该邮箱已注册，请直接登录')
  }

  if ((scene === 'login' || scene === 'resetPassword') && !user) {
    throw new EmailCodeError('EMAIL_NOT_REGISTERED', '该邮箱尚未注册，请先免费注册')
  }

  await ensureRedisConnected()

  const cooldownRedisKey = cooldownKey(email, scene)
  const locked = await redis.set(cooldownRedisKey, '1', 'EX', env.emailCodeResendSeconds, 'NX')
  if (locked !== 'OK') {
    throw new EmailCodeError('EMAIL_CODE_TOO_FREQUENT', '验证码发送太频繁，请稍后再试')
  }

  await assertHourlyLimit(emailHourlyLimitKey(email, scene), env.emailCodeMaxPerEmailHour)
  if (context.clientIp) {
    await assertHourlyLimit(ipHourlyLimitKey(context.clientIp, scene), env.emailCodeMaxPerIpHour)
  }

  const code = createCode()
  const emailCodeKey = codeKey(email, scene)

  await redis.set(
    emailCodeKey,
    JSON.stringify({
      codeHash: hashCode(email, scene, code),
      attempts: 0,
    } satisfies StoredEmailCode),
    'EX',
    env.emailCodeExpiresSeconds,
  )

  try {
    const sent = await sendCodeEmail(email, code, scene)
    if (!sent && env.nodeEnv === 'production') {
      await redis.del(emailCodeKey, cooldownRedisKey).catch(() => undefined)
      throw new EmailCodeError('EMAIL_CODE_SEND_FAILED', '验证码邮件发送失败，请稍后重试')
    }
    return {
      expiresIn: env.emailCodeExpiresSeconds,
      resendAfter: env.emailCodeResendSeconds,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[email-code] SMTP send failed: ${message}`)

    await redis.del(emailCodeKey, cooldownRedisKey).catch(() => undefined)
    throw new EmailCodeError('EMAIL_CODE_SEND_FAILED', '验证码邮件发送失败，请稍后重试')
  }
}

export async function verifyEmailCode(emailInput: string, scene: EmailCodeScene, code: string) {
  const email = normalizeEmail(emailInput)
  const emailCodeKey = codeKey(email, scene)

  await ensureRedisConnected()

  const stored = parseStoredCode(await redis.get(emailCodeKey))
  if (!stored) {
    throw new EmailCodeError('EMAIL_CODE_EXPIRED', '验证码已过期，请重新获取')
  }

  if (stored.codeHash !== hashCode(email, scene, code)) {
    const attempts = stored.attempts + 1
    if (attempts >= env.emailCodeMaxAttempts) {
      await redis.del(emailCodeKey)
      throw new EmailCodeError('EMAIL_CODE_EXPIRED', '验证码尝试次数过多，请重新获取')
    }

    const ttl = await redis.ttl(emailCodeKey)
    if (ttl <= 0) {
      await redis.del(emailCodeKey)
      throw new EmailCodeError('EMAIL_CODE_EXPIRED', '验证码已过期，请重新获取')
    }

    await redis.set(
      emailCodeKey,
      JSON.stringify({
        ...stored,
        attempts,
      } satisfies StoredEmailCode),
      'EX',
      ttl,
    )
    throw new EmailCodeError('EMAIL_CODE_INVALID', '验证码不正确，请重新输入')
  }

  await redis.del(emailCodeKey)
}
