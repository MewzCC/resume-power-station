import type { FastifyReply, FastifyRequest } from 'fastify'
import { ok, sendError } from '../lib/api-response.js'
import { NotFoundError } from '../lib/domain-errors.js'
import { markdownUpdateSchema } from '../schemas/resume.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import {
  getMarkdownVersion,
  updateMarkdownVersion,
} from '../services/resume-record.service.js'

export async function getMarkdownController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await getMarkdownVersion(id, user.id))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }
    if (error instanceof NotFoundError) {
      return sendError(reply, 404, 'NOT_FOUND', error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '获取 Markdown 版本失败')
  }
}

export async function updateMarkdownController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const parsed = markdownUpdateSchema.safeParse(request.body)

  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', 'Markdown 内容不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await updateMarkdownVersion({
      versionId: id,
      userId: user.id,
      markdown: parsed.data.markdown,
      theme: parsed.data.theme,
    }))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }
    if (error instanceof NotFoundError) {
      return sendError(reply, 404, 'NOT_FOUND', error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '更新 Markdown 版本失败')
  }
}
