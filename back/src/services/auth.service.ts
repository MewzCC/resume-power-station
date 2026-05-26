import type { FastifyRequest } from 'fastify'
import crypto from 'node:crypto'
import { sha256 } from '../lib/crypto.js'
import { NotFoundError } from '../lib/domain-errors.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { getClientIp } from '../lib/session.js'
import type {
  EmailCodeLoginInput,
  EmailCodeRegisterInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '../schemas/auth.js'
import { verifyEmailCode } from './email-code.service.js'

export const authCookieName = 'resume_auth_token'
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30

export class AuthError extends Error {
  code:
    | 'EMAIL_ALREADY_EXISTS'
    | 'EMAIL_NOT_REGISTERED'
    | 'PASSWORD_INCORRECT'
    | 'INVALID_CREDENTIALS'
    | 'UNAUTHENTICATED'

  constructor(code: AuthError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export type AuthUser = {
  id: string
  email: string
  name: string | null
  role: string
}

function publicUser(user: AuthUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function createRawToken() {
  return crypto.randomBytes(32)
}

function tokenToString(token: Buffer) {
  return token.toString('base64url')
}

function sessionExpiresAt() {
  return new Date(Date.now() + sessionMaxAgeSeconds * 1000)
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionMaxAgeSeconds,
    path: '/',
  }
}

export async function registerUser(input: RegisterInput, request: FastifyRequest) {
  const email = normalizeEmail(input.email)
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new AuthError('EMAIL_ALREADY_EXISTS', '该邮箱已注册，请直接登录')
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    },
  })

  const session = await createSession(user.id, request)
  return {
    user: publicUser(user),
    token: session.token,
    expiresAt: session.expiresAt,
  }
}

export async function loginUser(input: LoginInput, request: FastifyRequest) {
  const email = normalizeEmail(input.email)
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new AuthError('EMAIL_NOT_REGISTERED', '该邮箱尚未注册，请先免费注册')
  }

  const passwordMatched = await verifyPassword(input.password, user.passwordHash)
  if (!passwordMatched) {
    throw new AuthError('PASSWORD_INCORRECT', '密码错误，请重新输入')
  }

  const session = await createSession(user.id, request)
  return {
    user: publicUser(user),
    token: session.token,
    expiresAt: session.expiresAt,
  }
}

export async function registerUserWithEmailCode(input: EmailCodeRegisterInput, request: FastifyRequest) {
  const email = normalizeEmail(input.email)
  await verifyEmailCode(email, 'register', input.code)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new AuthError('EMAIL_ALREADY_EXISTS', '该邮箱已注册，请直接登录')
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    },
  })

  const session = await createSession(user.id, request)
  return {
    user: publicUser(user),
    token: session.token,
    expiresAt: session.expiresAt,
  }
}

export async function loginUserWithEmailCode(input: EmailCodeLoginInput, request: FastifyRequest) {
  const email = normalizeEmail(input.email)
  await verifyEmailCode(email, 'login', input.code)

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new AuthError('EMAIL_NOT_REGISTERED', '该邮箱尚未注册，请先免费注册')
  }

  const session = await createSession(user.id, request)
  return {
    user: publicUser(user),
    token: session.token,
    expiresAt: session.expiresAt,
  }
}

export async function resetPasswordWithEmailCode(input: ResetPasswordInput) {
  const email = normalizeEmail(input.email)
  await verifyEmailCode(email, 'resetPassword', input.code)

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new AuthError('EMAIL_NOT_REGISTERED', '该邮箱尚未注册，请先免费注册')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.password),
    },
  })

  await prisma.userSession.deleteMany({
    where: { userId: user.id },
  })

  return { reset: true }
}

async function createSession(userId: string, request: FastifyRequest) {
  const token = tokenToString(createRawToken())
  const expiresAt = sessionExpiresAt()

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash: sha256(token),
      userAgent: request.headers['user-agent'],
      ipHash: sha256(getClientIp(request)),
      expiresAt,
    },
  })

  return {
    token,
    expiresAt,
  }
}

export async function getUserFromToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) {
    return null
  }

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  })

  if (!session) {
    return null
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }

  return publicUser(session.user)
}

export async function requireAuthUser(token: string | undefined) {
  const user = await getUserFromToken(token)
  if (!user) {
    throw new AuthError('UNAUTHENTICATED', '请先登录后再使用免费优化次数')
  }
  return user
}

export async function logoutUser(token: string | undefined) {
  if (!token) {
    return
  }

  await prisma.userSession.delete({
    where: { tokenHash: sha256(token) },
  }).catch(() => undefined)
}

export function authTokenFromRequest(request: FastifyRequest) {
  return request.cookies[authCookieName]
}

export function unauthenticatedNotFound(message = '资源不存在或无权访问') {
  return new NotFoundError(message)
}
