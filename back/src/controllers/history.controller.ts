import type { FastifyReply, FastifyRequest } from 'fastify'
import { ok, sendError } from '../lib/api-response.js'
import { NotFoundError } from '../lib/domain-errors.js'
import { historyListQuerySchema, historyRestoreSchema } from '../schemas/history.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import {
  archiveHistoryRecord,
  getHistoryRecordDetail,
  listHistoryRecords,
  restoreHistoryRecord,
  unarchiveHistoryRecord,
} from '../services/history-record.service.js'

function handleHistoryError(error: unknown, reply: FastifyReply, fallback: string) {
  if (error instanceof AuthError) {
    return sendError(reply, 401, error.code, error.message)
  }
  if (error instanceof NotFoundError) {
    return sendError(reply, 404, 'NOT_FOUND', error.message)
  }
  return sendError(reply, 500, 'INTERNAL_ERROR', fallback)
}

export async function listHistoryController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = historyListQuerySchema.safeParse(request.query ?? {})
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '历史记录查询参数不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await listHistoryRecords(user.id, parsed.data))
  } catch (error) {
    return handleHistoryError(error, reply, '获取历史记录失败')
  }
}

export async function getHistoryDetailController(request: FastifyRequest, reply: FastifyReply) {
  const { historyId } = request.params as { historyId: string }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await getHistoryRecordDetail(historyId, user.id))
  } catch (error) {
    return handleHistoryError(error, reply, '获取历史详情失败')
  }
}

export async function restoreHistoryController(request: FastifyRequest, reply: FastifyReply) {
  const { historyId } = request.params as { historyId: string }
  const parsed = historyRestoreSchema.safeParse(request.body ?? {})
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '历史恢复参数不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await restoreHistoryRecord({
      versionId: historyId,
      userId: user.id,
      input: parsed.data,
    }))
  } catch (error) {
    return handleHistoryError(error, reply, '恢复历史记录失败')
  }
}

export async function archiveHistoryController(request: FastifyRequest, reply: FastifyReply) {
  const { historyId } = request.params as { historyId: string }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await archiveHistoryRecord(historyId, user.id))
  } catch (error) {
    return handleHistoryError(error, reply, '归档历史记录失败')
  }
}

export async function unarchiveHistoryController(request: FastifyRequest, reply: FastifyReply) {
  const { historyId } = request.params as { historyId: string }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await unarchiveHistoryRecord(historyId, user.id))
  } catch (error) {
    return handleHistoryError(error, reply, '恢复归档历史失败')
  }
}
