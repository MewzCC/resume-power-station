import { NotFoundError } from '../lib/domain-errors.js'
import { prisma } from '../lib/prisma.js'
import type { LapisTheme } from '../schemas/resume.js'

export async function getAnalysisById(id: string, userId: string) {
  const analysis = await prisma.resumeAnalysis.findUnique({
    where: { id },
    include: { resume: true },
  })

  if (!analysis || analysis.resume.userId !== userId) {
    throw new NotFoundError('分析结果不存在或无权访问')
  }

  return analysis
}

export async function getVersionById(id: string, userId: string) {
  const version = await prisma.optimizedVersion.findUnique({
    where: { id },
    include: { resume: true },
  })

  if (!version || version.resume.userId !== userId) {
    throw new NotFoundError('优化版本不存在或无权访问')
  }

  return version
}

export async function getLatestVersionByResumeId(resumeId: string, userId: string) {
  const version = await prisma.optimizedVersion.findFirst({
    where: {
      resumeId,
      resume: {
        userId,
      },
    },
    orderBy: { createdAt: 'desc' },
    include: { resume: true },
  })

  if (!version) {
    throw new NotFoundError('优化版本不存在')
  }

  return version
}

export async function getMarkdownVersion(versionId: string, userId: string) {
  const version = await prisma.optimizedVersion.findUnique({
    where: { id: versionId },
    include: { resume: true },
  })

  if (!version || version.resume.userId !== userId) {
    throw new NotFoundError('优化版本不存在或无权访问')
  }

  return {
    markdown: version.lapisMarkdown ?? '',
    theme: version.lapisTheme,
  }
}

export async function updateMarkdownVersion(params: {
  versionId: string
  userId: string
  markdown: string
  theme: LapisTheme
}) {
  const existing = await prisma.optimizedVersion.findUnique({
    where: { id: params.versionId },
    include: { resume: true },
  })

  if (!existing || existing.resume.userId !== params.userId) {
    throw new NotFoundError('优化版本不存在或无权访问')
  }

  const version = await prisma.optimizedVersion.update({
    where: { id: params.versionId },
    data: {
      lapisMarkdown: params.markdown,
      lapisTheme: params.theme,
    },
  })

  return {
    markdown: version.lapisMarkdown,
    theme: version.lapisTheme,
  }
}
