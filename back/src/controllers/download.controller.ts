import type { FastifyReply, FastifyRequest } from 'fastify'
import { sendError } from '../lib/api-response.js'
import { readDownloadFile } from '../services/download.service.js'

export async function downloadFileController(request: FastifyRequest, reply: FastifyReply) {
  const { filename } = request.params as { filename: string }
  const file = await readDownloadFile(filename)

  if (!file) {
    return sendError(reply, 404, 'NOT_FOUND', '下载文件不存在或已过期')
  }

  return reply
    .header('Content-Type', file.contentType)
    .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
    .send(file.buffer)
}
