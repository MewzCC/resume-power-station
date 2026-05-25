import type { FastifyReply, FastifyRequest } from 'fastify'
import { sendError } from '../lib/api-response.js'
import {
  InvalidOptimizedVersionError,
  NotFoundError,
} from '../lib/domain-errors.js'
import { pdfExportSchema } from '../schemas/resume.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import { PdfExportUnavailableError } from '../services/pdf.service.js'
import {
  buildDocxExport,
  buildPdfExport,
} from '../services/resume-export.service.js'

export async function exportDocxController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    const file = await buildDocxExport(id, user.id)
    return reply
      .header('Content-Type', file.contentType)
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
      .send(file.buffer)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }
    if (error instanceof NotFoundError) {
      return sendError(reply, 404, 'NOT_FOUND', error.message)
    }
    if (error instanceof InvalidOptimizedVersionError) {
      return sendError(reply, 500, 'AI_JSON_INVALID', error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '导出 Word 失败')
  }
}

export async function exportPdfController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const parsed = pdfExportSchema.safeParse(request.body ?? {})

  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', 'PDF 导出参数不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    const file = await buildPdfExport({
      versionId: id,
      userId: user.id,
      theme: parsed.data.theme,
    })

    return reply
      .header('Content-Type', file.contentType)
      .header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
      .send(file.buffer)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }
    if (error instanceof NotFoundError) {
      return sendError(reply, 404, 'NOT_FOUND', error.message)
    }
    if (error instanceof PdfExportUnavailableError) {
      return sendError(reply, 503, 'PDF_EXPORT_UNAVAILABLE', error.message)
    }
    return sendError(
      reply,
      500,
      'PDF_EXPORT_UNAVAILABLE',
      '在线 PDF 生成失败。你可以先下载 Markdown，并使用 VSCode / Typora / Obsidian 按 LapisCV 方式导出。',
    )
  }
}
