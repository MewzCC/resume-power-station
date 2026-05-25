import { extname } from 'node:path'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'
import { env } from '../lib/env.js'
import { extractPdfTextByCoordinates } from './pdf-layout-parser.service.js'
import { normalizeParsedResumeText } from './resume-text-normalizer.service.js'

export class FileParseError extends Error {
  code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE_TYPE' | 'PARSE_FAILED'

  constructor(code: FileParseError['code'], message: string) {
    super(message)
    this.code = code
  }
}

const supportedMimeTypes = new Set([
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const supportedExts = new Set(['.txt', '.md', '.markdown', '.pdf', '.docx'])

async function parsePdfBuffer(buffer: Buffer) {
  try {
    const text = await extractPdfTextByCoordinates(buffer)
    if (text.trim().length >= 20) {
      return text
    }
  } catch {
    // Fall back to pdf-parse below. Some malformed PDFs cannot expose text coordinates.
  }

  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}

export async function parseUploadedResume(params: {
  buffer: Buffer
  filename: string
  mimetype: string
}) {
  const maxBytes = env.uploadMaxSizeMb * 1024 * 1024
  if (params.buffer.byteLength > maxBytes) {
    throw new FileParseError('FILE_TOO_LARGE', `文件不能超过 ${env.uploadMaxSizeMb}MB`)
  }

  const ext = extname(params.filename).toLowerCase()
  const mimeOk = supportedMimeTypes.has(params.mimetype)
  const extOk = supportedExts.has(ext)

  if (!mimeOk && !extOk) {
    throw new FileParseError('UNSUPPORTED_FILE_TYPE', '仅支持 TXT、Markdown、DOCX、PDF 文件')
  }

  try {
    if (ext === '.docx' || params.mimetype.includes('wordprocessingml')) {
      const result = await mammoth.extractRawText({ buffer: params.buffer })
      return normalizeParsedResumeText(result.value)
    }

    if (ext === '.pdf' || params.mimetype === 'application/pdf') {
      return normalizeParsedResumeText(await parsePdfBuffer(params.buffer))
    }

    return normalizeParsedResumeText(params.buffer.toString('utf8'))
  } catch (error) {
    throw new FileParseError(
      'PARSE_FAILED',
      error instanceof Error ? error.message : '文件解析失败，请改用文本粘贴',
    )
  }
}
