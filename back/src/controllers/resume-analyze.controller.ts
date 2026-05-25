import type { FastifyReply, FastifyRequest } from 'fastify'
import { ok, sendError } from '../lib/api-response.js'
import { analyzeResumeSchema } from '../schemas/resume.js'
import { AiError } from '../services/ai.service.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import { createResumeOptimization } from '../services/resume-optimization.service.js'
import { DailyLimitExceededError } from '../services/usage.service.js'

export async function analyzeResumeController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = analyzeResumeSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '请求字段不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await createResumeOptimization(parsed.data, { userId: user.id }))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }

    if (error instanceof DailyLimitExceededError) {
      return sendError(
        reply,
        429,
        'DAILY_LIMIT_EXCEEDED',
        '你今天的 3 次免费优化已经用完啦。可以明天再来继续使用。赞助完全自愿，不影响核心功能。',
      )
    }

    if (error instanceof AiError) {
      return sendError(reply, error.code === 'REQUEST_TIMEOUT' ? 504 : 502, error.code, error.message)
    }

    return sendError(reply, 500, 'INTERNAL_ERROR', '创建简历优化失败')
  }
}
