import type { FastifyReply, FastifyRequest } from 'fastify'
import { ok, sendError } from '../lib/api-response.js'
import { getClientIp } from '../lib/session.js'
import {
  emailCodeLoginSchema,
  emailCodeRegisterSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sendEmailCodeSchema,
} from '../schemas/auth.js'
import {
  AuthError,
  authCookieName,
  authTokenFromRequest,
  getAuthCookieOptions,
  getUserFromToken,
  loginUser,
  loginUserWithEmailCode,
  logoutUser,
  registerUser,
  registerUserWithEmailCode,
  resetPasswordWithEmailCode,
} from '../services/auth.service.js'
import { EmailCodeError, requestEmailCode } from '../services/email-code.service.js'

function authErrorStatus(error: AuthError) {
  if (error.code === 'EMAIL_ALREADY_EXISTS') return 409
  if (error.code === 'EMAIL_NOT_REGISTERED') return 404
  if (error.code === 'UNAUTHENTICATED') return 401
  return 401
}

function emailCodeErrorStatus(error: EmailCodeError) {
  if (error.code === 'EMAIL_CODE_TOO_FREQUENT') return 429
  if (error.code === 'EMAIL_ALREADY_EXISTS') return 409
  if (error.code === 'EMAIL_NOT_REGISTERED') return 404
  return 400
}

export async function registerController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = registerSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '注册信息不合法', parsed.error.flatten())
  }

  try {
    const result = await registerUser(parsed.data, request)
    reply.setCookie(authCookieName, result.token, getAuthCookieOptions())
    return ok({
      user: result.user,
      expiresAt: result.expiresAt,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, authErrorStatus(error), error.code, error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '注册失败，请稍后重试')
  }
}

export async function loginController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = loginSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '登录信息不合法', parsed.error.flatten())
  }

  try {
    const result = await loginUser(parsed.data, request)
    reply.setCookie(authCookieName, result.token, getAuthCookieOptions())
    return ok({
      user: result.user,
      expiresAt: result.expiresAt,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, authErrorStatus(error), error.code, error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '登录失败，请稍后重试')
  }
}

export async function sendEmailCodeController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = sendEmailCodeSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '邮箱信息不合法', parsed.error.flatten())
  }

  try {
    const result = await requestEmailCode(parsed.data.email, parsed.data.scene, {
      clientIp: getClientIp(request),
    })
    return ok(result)
  } catch (error) {
    if (error instanceof EmailCodeError) {
      return sendError(reply, emailCodeErrorStatus(error), error.code, error.message)
    }
    return sendError(reply, 500, 'EMAIL_CODE_SEND_FAILED', '验证码邮件发送失败，请稍后重试')
  }
}

export async function emailCodeRegisterController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = emailCodeRegisterSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '注册信息不合法', parsed.error.flatten())
  }

  try {
    const result = await registerUserWithEmailCode(parsed.data, request)
    reply.setCookie(authCookieName, result.token, getAuthCookieOptions())
    return ok({
      user: result.user,
      expiresAt: result.expiresAt,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, authErrorStatus(error), error.code, error.message)
    }
    if (error instanceof EmailCodeError) {
      return sendError(reply, emailCodeErrorStatus(error), error.code, error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '注册失败，请稍后重试')
  }
}

export async function emailCodeLoginController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = emailCodeLoginSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '登录信息不合法', parsed.error.flatten())
  }

  try {
    const result = await loginUserWithEmailCode(parsed.data, request)
    reply.setCookie(authCookieName, result.token, getAuthCookieOptions())
    return ok({
      user: result.user,
      expiresAt: result.expiresAt,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, authErrorStatus(error), error.code, error.message)
    }
    if (error instanceof EmailCodeError) {
      return sendError(reply, emailCodeErrorStatus(error), error.code, error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '登录失败，请稍后重试')
  }
}

export async function resetPasswordController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = resetPasswordSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '重置密码信息不合法', parsed.error.flatten())
  }

  try {
    return ok(await resetPasswordWithEmailCode(parsed.data))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, authErrorStatus(error), error.code, error.message)
    }
    if (error instanceof EmailCodeError) {
      return sendError(reply, emailCodeErrorStatus(error), error.code, error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '重置密码失败，请稍后重试')
  }
}

export async function meController(request: FastifyRequest, reply: FastifyReply) {
  const user = await getUserFromToken(authTokenFromRequest(request))
  if (!user) {
    return sendError(reply, 401, 'UNAUTHENTICATED', '未登录或登录已过期')
  }

  return ok({ user })
}

export async function logoutController(request: FastifyRequest, reply: FastifyReply) {
  await logoutUser(authTokenFromRequest(request))
  reply.clearCookie(authCookieName, { path: '/' })
  return ok({ loggedOut: true })
}
