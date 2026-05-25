import type { FastifyReply, FastifyRequest } from 'fastify'
import { ok, sendError } from '../lib/api-response.js'
import { NotFoundError } from '../lib/domain-errors.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import {
  getAnalysisById,
  getVersionById,
} from '../services/resume-record.service.js'

export async function getAnalysisController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await getAnalysisById(id, user.id))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }
    if (error instanceof NotFoundError) {
      return sendError(reply, 404, 'NOT_FOUND', error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '获取分析结果失败')
  }
}

export async function getVersionController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await getVersionById(id, user.id))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }
    if (error instanceof NotFoundError) {
      return sendError(reply, 404, 'NOT_FOUND', error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '获取优化版本失败')
  }
}
