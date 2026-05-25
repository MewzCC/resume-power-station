import type { FastifyInstance } from 'fastify'
import { ok, sendError } from '../lib/api-response.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import { getTodayUsage } from '../services/usage.service.js'

export async function usageRoutes(app: FastifyInstance) {
  app.get('/api/usage/today', async (request, reply) => {
    try {
      const user = await requireAuthUser(authTokenFromRequest(request))
      return ok(await getTodayUsage({ userId: user.id }))
    } catch (error) {
      if (error instanceof AuthError) {
        return sendError(reply, 401, error.code, error.message)
      }
      return sendError(reply, 500, 'INTERNAL_ERROR', '获取今日使用次数失败')
    }
  })
}
