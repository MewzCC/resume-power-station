import { InvalidOptimizedVersionError, NotFoundError } from '../lib/domain-errors.js'
import { safeFilename } from '../lib/filename.js'
import { getDateStamp } from '../lib/time.js'
import { fullAiResultSchema } from '../schemas/ai.js'
import type { LapisTheme } from '../schemas/resume.js'
import { generateMarkdownDocx, generateResumeDocx } from './docx.service.js'
import { buildLapisHtml } from './markdown.service.js'
import { exportHtmlToPdf } from './pdf.service.js'
import {
  getLatestVersionByResumeId,
  getVersionById,
} from './resume-record.service.js'

export async function buildDocxExport(resumeId: string, userId: string) {
  const latestVersion = await getLatestVersionByResumeId(resumeId, userId)
  const parsed = fullAiResultSchema.shape.optimizedResume.safeParse(latestVersion.optimizedJson)

  if (!parsed.success) {
    throw new InvalidOptimizedVersionError('优化版本结构不完整，无法导出 Word')
  }

  const buffer = await generateResumeDocx(parsed.data)
  const filename = safeFilename(`优化后简历-${latestVersion.resume.targetJob}-${getDateStamp()}.docx`)

  return {
    buffer,
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
}

export async function buildPdfExport(params: {
  versionId: string
  userId: string
  theme: LapisTheme
}) {
  const version = await getVersionById(params.versionId, params.userId)

  if (!version.lapisMarkdown) {
    throw new NotFoundError('Markdown 版本不存在')
  }

  const html = await buildLapisHtml({
    markdown: version.lapisMarkdown,
    theme: params.theme,
  })
  const buffer = await exportHtmlToPdf(html)
  const filename = safeFilename(`优化后简历-${version.resume.targetJob}-${getDateStamp()}.pdf`)

  return {
    buffer,
    filename,
    contentType: 'application/pdf',
  }
}

export async function buildPdfExportFromMarkdown(params: {
  markdown: string
  theme: LapisTheme
  filename: string
}) {
  const html = await buildLapisHtml({
    markdown: params.markdown,
    theme: params.theme,
  })
  const buffer = await exportHtmlToPdf(html)

  return {
    buffer,
    filename: safeFilename(params.filename),
    contentType: 'application/pdf',
  }
}

export async function buildDocxExportFromMarkdown(params: {
  markdown: string
  filename: string
}) {
  const buffer = await generateMarkdownDocx(params.markdown)

  return {
    buffer,
    filename: safeFilename(params.filename),
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
}
