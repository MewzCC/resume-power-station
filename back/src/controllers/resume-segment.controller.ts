import type { FastifyReply, FastifyRequest } from 'fastify'
import { fail, ok, sendError } from '../lib/api-response.js'
import { env } from '../lib/env.js'
import { segmentResumeSchema } from '../schemas/resume.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import { AiError, heuristicSegmentResume, segmentResumeText } from '../services/ai.service.js'

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

export async function segmentResumeStreamController(request: FastifyRequest, reply: FastifyReply) {
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

  reply.raw.writeHead(200, {
    ...corsHeadersFor(request),
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const heartbeat = setInterval(() => {
    reply.raw.write(': heartbeat\n\n')
  }, 15000)

  try {
    writeEvent(reply, {
      stage: 'accepted',
      progress: 5,
      message: '已收到简历文本，正在准备分块。',
    })

    const preliminary = heuristicSegmentResume(parsed.data)
    writeEvent(reply, {
      stage: 'initial_text',
      progress: 25,
      message: `已完成初步分块：${preliminary.sections.length} 个模块。`,
      text: preliminary.text,
      sections: preliminary.sections,
      warnings: preliminary.warnings,
    })

    writeEvent(reply, {
      stage: 'segmenting',
      progress: 55,
      message: '正在调用 AI 校正文档结构和模块归属。',
    })

    const result = await segmentResumeText(parsed.data)
    writeEvent(reply, {
      stage: 'done',
      progress: 100,
      message: `AI 分块完成：${result.sections.length} 个模块。`,
      result,
      text: result.text,
      sections: result.sections,
      warnings: result.warnings,
    })
  } catch (error) {
    request.log.error(error)
    if (error instanceof AiError) {
      writeError(reply, error.code, error.message)
      return
    }
    writeError(reply, 'AI_FAILED', 'AI 分块整理失败，请稍后重试')
  } finally {
    clearInterval(heartbeat)
    reply.raw.end()
  }
}
