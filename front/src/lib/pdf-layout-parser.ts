import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { cleanResumeText } from './resume-parser'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type PdfTextItem = {
  str: string
  transform: number[]
  width: number
  height: number
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
  const tolerance = Math.max(2.8, Math.min(a.height || 10, b.height || 10) * 0.42)
  return Math.abs(a.y - b.y) <= tolerance
}

function shouldInsertSpace(previous: PositionedText, current: PositionedText) {
  const gap = current.x - (previous.x + previous.width)
  if (gap < 2) return false
  if (/[:：/@.+~-]$/.test(previous.text)) return false
  if (/^[,，.。;；:：)）\]}]/.test(current.text)) return false
  return gap > 4
}

function joinLine(items: PositionedText[]) {
  return items
    .sort((a, b) => a.x - b.x)
    .reduce((line, item, index, sortedItems) => {
      if (index === 0) return item.text
      return `${line}${shouldInsertSpace(sortedItems[index - 1], item) ? ' ' : ''}${item.text}`
    }, '')
    .trim()
}

function buildLines(items: PositionedText[]) {
  const lines: PositionedText[][] = []

  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((candidate) => sameLine(candidate[0], item))
    if (line) {
      line.push(item)
    } else {
      lines.push([item])
    }
  }

  return lines.map(joinLine).filter(Boolean)
}

export async function extractPdfTextByLayout(file: File) {
  const data = new Uint8Array(await file.arrayBuffer())
  const document = await pdfjsLib.getDocument({ data }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const items = textContent.items
      .flatMap((item) => {
        if (!isTextItem(item)) return []

        return [{
          text: item.str.trim(),
          x: Number(item.transform[4] ?? 0),
          y: Number(item.transform[5] ?? 0),
          width: Number(item.width ?? 0),
          height: Number(item.height ?? item.transform[3] ?? 10),
        }]
      })
      .filter((item) => item.text.length > 0)

    pages.push(buildLines(items).join('\n'))
  }

  return cleanResumeText(pages.join('\n'))
}
