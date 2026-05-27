import type { FastifyReply, FastifyRequest } from 'fastify'
import { fail, ok, sendError } from '../lib/api-response.js'
import { env } from '../lib/env.js'
import { segmentResumeSchema } from '../schemas/resume.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import { AiError, segmentResumeText } from '../services/ai.service.js'

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

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function writeTextDeltas(reply: FastifyReply, text: string) {
  const chars = Array.from(text)
  const chunkSize = 10
  const total = Math.max(1, chars.length)

  for (let index = 0; index < chars.length; index += chunkSize) {
    const delta = chars.slice(index, index + chunkSize).join('')
    const typed = Math.min(total, index + chunkSize)
    const progress = Math.min(98, 60 + Math.round((typed / total) * 38))

    writeEvent(reply, {
      stage: 'text_delta',
      progress,
      delta,
      typed,
      total,
    })

    await sleep(10)
  }
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
      message: '已收到简历文本，正在调用 AI 分块解析。',
    })

    writeEvent(reply, {
      stage: 'segmenting',
      progress: 35,
      message: 'AI 正在识别简历模块，请稍候。',
    })

    const result = await segmentResumeText(parsed.data)
    writeEvent(reply, {
      stage: 'writing',
      progress: 60,
      message: `AI 已完成结构识别，正在流式写入 ${result.sections.length} 个模块。`,
    })
    await writeTextDeltas(reply, result.text)

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
