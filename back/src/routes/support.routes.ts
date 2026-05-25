import type { FastifyInstance } from 'fastify'
import { ok } from '../lib/api-response.js'
import { env } from '../lib/env.js'

export async function supportRoutes(app: FastifyInstance) {
  app.get('/api/support/config', async () =>
    ok({
      afdianUrl: env.afdianUrl,
      wechatQrUrl: '/support/wechat-qr.png',
      alipayQrUrl: '/support/alipay-qr.png',
      statement: '赞助完全自愿，不影响核心功能使用。',
    }),
  )
}
