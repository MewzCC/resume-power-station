import type { FastifyReply, FastifyRequest } from 'fastify'
import { randomId, sha256 } from './crypto.js'
import { env } from './env.js'

const cookieName = 'resume_session_id'

export type AnonymousIdentity = {
  sessionId: string
  fingerprint: string
  ipHash: string
}

export function getClientIp(request: FastifyRequest) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? request.ip
  }
  return request.ip
}

export function getOrCreateAnonymousIdentity(request: FastifyRequest, reply: FastifyReply): AnonymousIdentity {
  const cookieValue = request.cookies[cookieName]
  const sessionId = typeof cookieValue === 'string' && cookieValue.length > 0 ? cookieValue : randomId()

  if (!cookieValue) {
    reply.setCookie(cookieName, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.nodeEnv === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
  }

  const ip = getClientIp(request)

  return {
    sessionId,
    fingerprint: sha256(sessionId),
    ipHash: sha256(ip),
  }
}
