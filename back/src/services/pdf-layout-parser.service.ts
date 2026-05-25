import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

type PdfTextItem = {
  str: string
  transform: number[]
  width?: number
  height?: number
}

type PositionedText = {
  text: string
  x: number
  y: number
  width: number
  height: number
}

function isTextItem(item: unknown): item is PdfTextItem {
  return Boolean(
    item
      && typeof item === 'object'
      && 'str' in item
      && typeof (item as PdfTextItem).str === 'string'
      && Array.isArray((item as PdfTextItem).transform),
  )
}

function sameLine(a: PositionedText, b: PositionedText) {
  const baseHeight = Math.max(8, Math.min(a.height || 10, b.height || 10))
  return Math.abs(a.y - b.y) <= Math.max(2.5, baseHeight * 0.45)
}

function shouldInsertSpace(previous: PositionedText, current: PositionedText) {
  const gap = current.x - (previous.x + previous.width)
  if (gap <= 1.5) return false
  if (/[:：/@.+~\-_(（[]$/.test(previous.text)) return false
  if (/^[,，.。;；:：)）\]}、]/.test(current.text)) return false
  if (/^[A-Za-z0-9]/.test(current.text) && /[A-Za-z0-9]$/.test(previous.text)) return gap > 2.5
  return gap > 4
}

function joinLine(items: PositionedText[]) {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  return sorted.reduce((line, item, index) => {
    if (index === 0) return item.text
    const previous = sorted[index - 1]
    return `${line}${previous && shouldInsertSpace(previous, item) ? ' ' : ''}${item.text}`
  }, '').trim()
}

function buildLines(items: PositionedText[]) {
  const lines: PositionedText[][] = []
  const sortedItems = [...items].sort((a, b) => b.y - a.y || a.x - b.x)

  for (const item of sortedItems) {
    const line = lines.find((candidate) => {
      const first = candidate[0]
      return first ? sameLine(first, item) : false
    })
    if (line) {
      line.push(item)
    } else {
      lines.push([item])
    }
  }

  return lines.map(joinLine).filter(Boolean)
}

function normalizePdfBullet(text: string) {
  return text.replace(/[•●▪■◆]/g, '·')
}

export async function extractPdfTextByCoordinates(buffer: Buffer) {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise
  const pages: string[] = []

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent({
        includeMarkedContent: false,
        disableNormalization: false,
      })
      const items = textContent.items
        .flatMap((item) => {
          if (!isTextItem(item)) return []
          const text = normalizePdfBullet(item.str.trim())
          if (!text) return []

          return [{
            text,
            x: Number(item.transform[4] ?? 0),
            y: Number(item.transform[5] ?? 0),
            width: Number(item.width ?? 0),
            height: Number(item.height ?? item.transform[3] ?? 10),
          }]
        })

      pages.push(buildLines(items).join('\n'))
      await page.cleanup()
    }
  } finally {
    await document.destroy()
  }

  return pages.join('\n\n')
}
