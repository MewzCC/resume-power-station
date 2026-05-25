import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import type { OptimizedResumeResult } from '../schemas/ai.js'

function paragraph(text: string) {
  return new Paragraph({
    children: [new TextRun({ text })],
    spacing: { after: 100 },
  })
}

function heading(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 100 },
  })
}

export async function generateResumeDocx(resume: OptimizedResumeResult) {
  const children: Paragraph[] = [
    new Paragraph({
      text: '优化后的简历',
      heading: HeadingLevel.TITLE,
    }),
    heading('个人简介'),
    paragraph(resume.profile.optimized),
    heading('技能清单'),
    ...resume.skills.optimized.map((skill) => paragraph(`- ${skill}`)),
    heading('项目经历'),
  ]

  for (const project of resume.projects) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: project.title, bold: true })],
        spacing: { before: 120, after: 80 },
      }),
      paragraph(project.context),
      ...project.optimizedBullets.map((bullet) => paragraph(`- ${bullet}`)),
    )
  }

  if (resume.additionalSuggestions.length > 0) {
    children.push(heading('后续建议'), ...resume.additionalSuggestions.map((item) => paragraph(`- ${item}`)))
  }

  const doc = new Document({
    sections: [{ children }],
  })

  return Packer.toBuffer(doc)
}

export async function generateMarkdownDocx(markdown: string, title = '优化后的简历') {
  const children: Paragraph[] = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
    }),
  ]

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2).trim(), heading: HeadingLevel.TITLE }))
      continue
    }

    if (line.startsWith('## ')) {
      children.push(heading(line.slice(3).trim()))
      continue
    }

    if (line.startsWith('### ')) {
      children.push(new Paragraph({
        text: line.slice(4).trim(),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 80 },
      }))
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      children.push(paragraph(`- ${line.replace(/^[-*]\s+/, '')}`))
      continue
    }

    children.push(paragraph(line.replace(/\*\*/g, '')))
  }

  const doc = new Document({
    sections: [{ children }],
  })

  return Packer.toBuffer(doc)
}
