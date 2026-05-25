import type { FastifyReply, FastifyRequest } from 'fastify'
import { ok, sendError } from '../lib/api-response.js'
import { NotFoundError } from '../lib/domain-errors.js'
import {
  createResumeSchema,
  exportResumeSchema,
  optimizeResumeSchema,
  saveResumeVersionSchema,
} from '../schemas/resume.js'
import { AiError } from '../services/ai.service.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import {
  assertResumeOwner,
  createTextResume,
  getResumeDiff,
  listResumeHistory,
  listUserResumes,
  saveResumeVersion,
} from '../services/resume-contract.service.js'
import {
  buildDocxExport,
  buildDocxExportFromMarkdown,
  buildPdfExport,
  buildPdfExportFromMarkdown,
} from '../services/resume-export.service.js'
import { optimizeExistingResume } from '../services/resume-optimization.service.js'
import { DailyLimitExceededError } from '../services/usage.service.js'
import { writeDownloadFile } from '../services/download.service.js'
import { PdfExportUnavailableError } from '../services/pdf.service.js'

function requestBaseUrl(request: FastifyRequest) {
  const host = request.headers.host ?? 'localhost:3001'
  const protocol = request.protocol || 'http'
  return `${protocol}://${host}`
}

function handleSharedError(error: unknown, reply: FastifyReply, fallback: string) {
  if (error instanceof AuthError) {
    return sendError(reply, 401, error.code, error.message)
  }
  if (error instanceof NotFoundError) {
    return sendError(reply, 404, 'NOT_FOUND', error.message)
  }
  if (error instanceof DailyLimitExceededError) {
    return sendError(reply, 429, 'DAILY_LIMIT_EXCEEDED', '今天的免费优化次数已经用完，明天可以继续使用。')
  }
  if (error instanceof AiError) {
    return sendError(reply, error.code === 'REQUEST_TIMEOUT' ? 504 : 502, error.code, error.message)
  }
  if (error instanceof PdfExportUnavailableError) {
    return sendError(reply, 503, 'PDF_EXPORT_UNAVAILABLE', error.message)
  }
  return sendError(reply, 500, 'INTERNAL_ERROR', fallback)
}

export async function createResumeController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createResumeSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '创建简历参数不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await createTextResume(parsed.data, user.id))
  } catch (error) {
    return handleSharedError(error, reply, '创建简历失败')
  }
}

export async function optimizeResumeController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const parsed = optimizeResumeSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '优化参数不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    const result = await optimizeExistingResume({
      resumeId: id,
      userId: user.id,
      input: parsed.data,
    })

    if (!result) {
      return sendError(reply, 404, 'NOT_FOUND', '简历不存在或无权访问')
    }

    return ok(result)
  } catch (error) {
    return handleSharedError(error, reply, '创建简历优化失败')
  }
}

export async function getResumeDiffController(request: FastifyRequest, reply: FastifyReply) {
  const { resumeId, versionId } = request.params as { resumeId: string; versionId: string }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await getResumeDiff({ resumeId, versionId, userId: user.id }))
  } catch (error) {
    return handleSharedError(error, reply, '获取版本对比失败')
  }
}

export async function saveResumeVersionController(request: FastifyRequest, reply: FastifyReply) {
  const { versionId } = request.params as { versionId: string }
  const parsed = saveResumeVersionSchema.safeParse(request.body)
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '保存版本参数不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await saveResumeVersion({
      versionId,
      userId: user.id,
      input: parsed.data,
    }))
  } catch (error) {
    return handleSharedError(error, reply, '保存优化版本失败')
  }
}

export async function exportResumePdfUrlController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const parsed = exportResumeSchema.safeParse(request.body ?? {})
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '导出参数不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    await assertResumeOwner({ resumeId: id, userId: user.id })
    const requested = parsed.data.filename?.endsWith('.pdf')
      ? parsed.data.filename
      : `${parsed.data.filename ?? 'resume'}.pdf`
    const file = parsed.data.markdown
      ? await buildPdfExportFromMarkdown({
          markdown: parsed.data.markdown,
          theme: parsed.data.theme,
          filename: requested,
        })
      : await buildPdfExport({
          versionId: parsed.data.versionId ?? id,
          userId: user.id,
          theme: parsed.data.theme,
        })

    return ok(await writeDownloadFile({
      buffer: file.buffer,
      filename: file.filename,
      baseUrl: requestBaseUrl(request),
    }))
  } catch (error) {
    return handleSharedError(error, reply, '导出 PDF 失败')
  }
}

export async function exportResumeDocxUrlController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string }
  const parsed = exportResumeSchema.safeParse(request.body ?? {})
  if (!parsed.success) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '导出参数不合法', parsed.error.flatten())
  }

  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    await assertResumeOwner({ resumeId: id, userId: user.id })
    const requested = parsed.data.filename?.endsWith('.docx')
      ? parsed.data.filename
      : `${parsed.data.filename ?? 'resume'}.docx`
    const file = parsed.data.markdown
      ? await buildDocxExportFromMarkdown({
          markdown: parsed.data.markdown,
          filename: requested,
        })
      : await buildDocxExport(id, user.id)

    return ok(await writeDownloadFile({
      buffer: file.buffer,
      filename: file.filename,
      baseUrl: requestBaseUrl(request),
    }))
  } catch (error) {
    return handleSharedError(error, reply, '导出 Word 失败')
  }
}

export async function listResumesController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await listUserResumes(user.id))
  } catch (error) {
    return handleSharedError(error, reply, '获取简历列表失败')
  }
}

export async function listResumeHistoryController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await requireAuthUser(authTokenFromRequest(request))
    return ok(await listResumeHistory(user.id))
  } catch (error) {
    return handleSharedError(error, reply, '获取优化历史失败')
  }
}
