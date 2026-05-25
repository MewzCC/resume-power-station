import type { FastifyReply, FastifyRequest } from 'fastify'
import { ok, sendError } from '../lib/api-response.js'
import {
  AuthError,
  authTokenFromRequest,
  requireAuthUser,
} from '../services/auth.service.js'
import {
  FileParseError,
  parseUploadedResume,
} from '../services/file-parser.service.js'
import { createParsedResume } from '../services/resume-contract.service.js'

export async function parseResumeController(request: FastifyRequest, reply: FastifyReply) {
  let user: Awaited<ReturnType<typeof requireAuthUser>>

  try {
    user = await requireAuthUser(authTokenFromRequest(request))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(reply, 401, error.code, error.message)
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', '鉴权失败')
  }

  const file = await request.file()
  if (!file) {
    return sendError(reply, 400, 'VALIDATION_ERROR', '请上传简历文件')
  }

  try {
    const buffer = await file.toBuffer()
    const text = await parseUploadedResume({
      buffer,
      filename: file.filename,
      mimetype: file.mimetype,
    })
    const resume = await createParsedResume({
      userId: user.id,
      text,
      originalName: file.filename,
    })

    return ok({
      resumeId: resume.id,
      text,
      markdown: file.filename.toLowerCase().match(/\.md|\.markdown/) ? text : undefined,
      originalName: file.filename,
      size: buffer.byteLength,
    })
  } catch (error) {
    if (error instanceof FileParseError) {
      const status = error.code === 'FILE_TOO_LARGE' ? 413 : 400
      return sendError(reply, status, error.code, error.message)
    }
    return sendError(reply, 500, 'PARSE_FAILED', '文件解析失败，请改用文本粘贴')
  }
}
