import fs from 'node:fs/promises'
import path from 'node:path'
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'
import type { LapisTheme } from '../schemas/resume.js'

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
})

export function renderMarkdownToHtml(markdownText: string) {
  const withPageBreaks = markdownText.replace(/^---$/gm, '<div class="page-break"></div>')
  const html = markdown.render(withPageBreaks)

  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'div']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'width', 'height'],
      div: ['class'],
    },
    allowedSchemes: ['http', 'https', 'data', 'mailto'],
  })
}

async function readCssFile(filename: string) {
  const file = path.join(process.cwd(), 'public', 'lapiscv', 'styles', filename)
  return fs.readFile(file, 'utf8')
}

export async function buildLapisHtml(params: {
  markdown: string
  theme: LapisTheme
}) {
  const bodyHtml = renderMarkdownToHtml(params.markdown)
  const mainCss = await readCssFile('main.css')
  const themeCss = await readCssFile(params.theme === 'lapis-cv-serif' ? 'lapis-cv-serif.css' : 'lapis-cv.css')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page {
      size: A4;
      margin: 13mm 15mm;
    }
    ${mainCss}
    ${themeCss}
  </style>
</head>
<body>
  <main class="markdown-body">
    ${bodyHtml}
  </main>
</body>
</html>`
}
