import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import { env } from './lib/env.js'
import { ok } from './lib/api-response.js'
import { authRoutes } from './routes/auth.routes.js'
import { resumeRoutes } from './routes/resume.routes.js'
import { supportRoutes } from './routes/support.routes.js'
import { usageRoutes } from './routes/usage.routes.js'

function allowedOrigins() {
  return new Set([
    ...env.webOrigin.split(',').map((item) => item.trim()).filter(Boolean),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ])
}

function isAllowedOrigin(origin: string) {
  if (allowedOrigins().has(origin)) {
    return true
  }

  if (env.nodeEnv === 'development') {
    return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  }

  return false
}

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === 'development' ? 'info' : 'warn',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  })

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    credentials: true,
  })

  await app.register(cookie)
  await app.register(multipart, {
    limits: {
      fileSize: env.uploadMaxSizeMb * 1024 * 1024,
      files: 1,
    },
  })

  app.get('/health', async () =>
    ok({
      status: 'ok',
      service: 'resume-power-station-typescript',
      mockAi: env.mockAi,
    }),
  )

  await app.register(authRoutes)
  await app.register(usageRoutes)
  await app.register(supportRoutes)
  await app.register(resumeRoutes)

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)
    reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务暂时不可用，请稍后重试',
      },
    })
  })

  return app
}

const app = await buildServer()

try {
  await app.listen({ port: env.port, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
