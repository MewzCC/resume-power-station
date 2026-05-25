import type { FastifyReply, FastifyRequest } from 'fastify'
import { fail, sendError } from '../lib/api-response.js'
import { env } from '../lib/env.js'
import { optimizeResumeSchema } from '../schemas/resume.js'
import { AiError } from '../services/ai.service.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import { optimizeExistingResume } from '../services/resume-optimization.service.js'
import { DailyLimitExceededError } from '../services/usage.service.js'

type StreamEvent = Record<string, unknown>

function writeEvent(reply: FastifyReply, event: StreamEvent) {
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
}

function writeError(reply: FastifyReply, code: Parameters<typeof fail>[0], message: string) {
  writeEvent(reply, {
    stage: 'error',
    progress: 100,
    error: {
      code,
      message,
    },
  })
}

function corsHeadersFor(request: FastifyRequest) {
  const origin = request.headers.origin
  if (!origin) return {}

  const configuredOrigins = new Set(env.webOrigin.split(',').map((item) => item.trim()).filter(Boolean))
  const allowed = configuredOrigins.has(origin)
    || (env.nodeEnv === 'development' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))

  if (!allowed) return {}

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

export async function optimizeResumeStreamController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const parsed = optimizeResumeSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '优化参数不合法', parsed.error.flatten())
  }

  let user: Awaited<ReturnType<typeof requireAuthUser>>
  try {
    user = await requireAuthUser(authTokenFromRequest(request))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '鉴权失败')
  }

  reply.raw.writeHead(200, {
    ...corsHeadersFor(request),
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  writeEvent(reply, {
    stage: 'accepted',
    progress: 3,
    message: '优化任务已开始',
  })

  const heartbeat = setInterval(() => {
    reply.raw.write(': heartbeat\n\n')
  }, 15000)

  try {
    const result = await optimizeExistingResume({
      resumeId: id,
      userId: user.id,
      input: parsed.data,
      onProgress: (event) => writeEvent(reply, event),
    })

    if (!result) {
      writeError(reply, 'NOT_FOUND', '简历不存在或无权访问')
      return
    }

    writeEvent(reply, {
      stage: 'done',
      progress: 100,
      message: '优化完成',
      result,
    })
  } catch (error) {
    request.log.error(error)
    if (error instanceof DailyLimitExceededError) {
      writeError(reply, 'DAILY_LIMIT_EXCEEDED', '今天的免费优化次数已经用完，明天可以继续使用。')
      return
    }
    if (error instanceof AiError) {
      writeError(reply, error.code, error.message)
      return
    }
    writeError(reply, 'INTERNAL_ERROR', '创建简历优化失败')
  } finally {
    clearInterval(heartbeat)
    reply.raw.end()
  }
}
