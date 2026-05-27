import type { FastifyReply, FastifyRequest } from 'fastify'
import { ok, sendError } from '../lib/api-response.js'
import { segmentResumeSchema } from '../schemas/resume.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import { AiError, segmentResumeText } from '../services/ai.service.js'

export async function segmentResumeController(request: FastifyRequest, reply: FastifyReply) {
  try {
    await requireAuthUser(authTokenFromRequest(request))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '鉴权失败，请稍后重试')
  }

  const parsed = segmentResumeSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '简历分块参数不合法', parsed.error.flatten())
  }

  try {
    return ok(await segmentResumeText(parsed.data))
  } catch (error) {
    if (error instanceof AiError) {
      const status = error.code === 'REQUEST_TIMEOUT' ? 504 : 502
      return sendError(reply, status, error.code, error.message)
    }
    return sendError(reply, 500, 'AI_FAILED', 'AI 分块整理失败，请稍后重试')
  }
}
