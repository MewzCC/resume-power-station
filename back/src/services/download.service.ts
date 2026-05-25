import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { safeFilename } from '../lib/filename.js'

const downloadDir = path.join(process.cwd(), 'public', 'downloads')

function contentTypeFor(filename: string) {
  if (filename.endsWith('.pdf')) return 'application/pdf'
  if (filename.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return 'application/octet-stream'
}

export async function writeDownloadFile(params: {
  buffer: Buffer
  filename: string
  baseUrl: string
}) {
  await fs.mkdir(downloadDir, { recursive: true })
  const ext = path.extname(params.filename) || '.bin'
  const basename = safeFilename(path.basename(params.filename, ext)) || 'resume'
  const storedName = `${Date.now()}-${randomUUID()}-${basename}${ext}`
  await fs.writeFile(path.join(downloadDir, storedName), params.buffer)

  return {
    downloadUrl: `${params.baseUrl}/downloads/${encodeURIComponent(storedName)}`,
    filename: `${basename}${ext}`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }
}

export async function readDownloadFile(filename: string) {
  const decoded = decodeURIComponent(filename)
  const safeName = path.basename(decoded)
  if (safeName !== decoded || !safeName) {
    return null
  }

  const filePath = path.join(downloadDir, safeName)
  try {
    const buffer = await fs.readFile(filePath)
    return {
      buffer,
      filename: safeName,
      contentType: contentTypeFor(safeName),
    }
  } catch {
    return null
  }
}
