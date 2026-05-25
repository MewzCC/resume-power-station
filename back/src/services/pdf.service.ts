import { chromium } from 'playwright'
import { env } from '../lib/env.js'

export class PdfExportUnavailableError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export async function exportHtmlToPdf(html: string) {
  if (!env.enablePdfExport) {
    throw new PdfExportUnavailableError('当前环境未启用在线 PDF 导出')
  }

  let browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch (error) {
    console.error('[pdf] Failed to launch browser:', error)
    throw new PdfExportUnavailableError(
      `浏览器启动失败。请运行 "npx playwright install chromium" 安装浏览器。原因: ${error instanceof Error ? error.message : '未知错误'}`
    )
  }

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '13mm',
        bottom: '13mm',
        left: '15mm',
        right: '15mm',
      },
    })
  } catch (error) {
    console.error('[pdf] PDF generation failed:', error)
    throw new PdfExportUnavailableError(
      `PDF 生成失败: ${error instanceof Error ? error.message : '未知错误'}`
    )
  } finally {
    await browser.close()
  }
}
