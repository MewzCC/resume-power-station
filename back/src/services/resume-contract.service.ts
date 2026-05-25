import { NotFoundError } from '../lib/domain-errors.js'
import { prisma } from '../lib/prisma.js'
import { toJson } from '../lib/json.js'
import type {
  CreateResumeInput,
  LapisTheme,
  SaveResumeVersionInput,
} from '../schemas/resume.js'
import { analysisSchema, fullAiResultSchema } from '../schemas/ai.js'
import { buildDiffPayload } from './resume-diff.service.js'
import { buildVersionSnapshot } from './history-record.service.js'

function sourceTypeFromName(name?: string | null): 'markdown' | 'text' | 'pdf' | 'docx' {
  const lower = name?.toLowerCase() ?? ''
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown'
  return 'text'
}

function titleFromResume(resume: { originalName: string | null; targetJob: string }) {
  return resume.originalName?.replace(/\.[^.]+$/, '') || `${resume.targetJob}简历`
}

async function latestAnalysisForResume(resumeId: string) {
  return prisma.resumeAnalysis.findFirst({
    where: { resumeId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createTextResume(input: CreateResumeInput, userId: string) {
  const resume = await prisma.resume.create({
    data: {
      userId,
      originalName: input.originalName ?? input.title,
      originalText: input.content,
      targetJob: input.title,
      jobDescription: '',
      jobStage: 'other',
      outputLanguage: 'zh',
      optimizeLevel: 'standard',
    },
  })

  return {
    resumeId: resume.id,
  }
}

export async function createParsedResume(params: {
  userId: string
  text: string
  originalName: string
}) {
  const resume = await prisma.resume.create({
    data: {
      userId: params.userId,
      originalName: params.originalName,
      originalText: params.text,
      targetJob: '待填写目标岗位',
      jobDescription: '',
      jobStage: 'other',
      outputLanguage: 'zh',
      optimizeLevel: 'standard',
    },
  })

  return resume
}

export async function assertResumeOwner(params: {
  resumeId: string
  userId: string
}) {
  const resume = await prisma.resume.findFirst({
    where: {
      id: params.resumeId,
      userId: params.userId,
    },
  })

  if (!resume) {
    throw new NotFoundError('简历不存在或无权访问')
  }

  return resume
}

export async function getResumeDiff(params: {
  resumeId: string
  versionId: string
  userId: string
}) {
  const version = await prisma.optimizedVersion.findFirst({
    where: {
      id: params.versionId,
      resumeId: params.resumeId,
      resume: {
        userId: params.userId,
      },
    },
    include: {
      resume: true,
    },
  })

  if (!version) {
    throw new NotFoundError('优化版本不存在或无权访问')
  }

  const analysis = await latestAnalysisForResume(version.resumeId)
  const parsedAnalysis = analysisSchema.safeParse(analysis?.analysisJson)
  const parsedOptimized = fullAiResultSchema.shape.optimizedResume.safeParse(version.optimizedJson)

  if (!parsedAnalysis.success || !parsedOptimized.success) {
    throw new NotFoundError('优化版本数据不完整')
  }

  return buildDiffPayload({
    resume: version.resume,
    analysis: parsedAnalysis.data,
    optimizedResume: parsedOptimized.data,
    version,
  })
}

export async function saveResumeVersion(params: {
  versionId: string
  userId: string
  input: SaveResumeVersionInput
}) {
  const existing = await prisma.optimizedVersion.findFirst({
    where: {
      id: params.versionId,
      resume: {
        userId: params.userId,
      },
    },
    include: {
      resume: true,
    },
  })

  if (!existing) {
    throw new NotFoundError('优化版本不存在或无权访问')
  }

  const current = typeof existing.optimizedJson === 'object' && existing.optimizedJson !== null
    ? existing.optimizedJson as Record<string, unknown>
    : {}
  const updated = await prisma.optimizedVersion.update({
    where: { id: params.versionId },
    data: {
      lapisMarkdown: params.input.markdown,
      lapisTheme: params.input.theme,
      optimizedJson: toJson({
        ...current,
        markdown: params.input.markdown,
        changes: params.input.changes,
      }),
    },
  })
  const analysis = await latestAnalysisForResume(existing.resumeId)
  const parsedAnalysis = analysisSchema.safeParse(analysis?.analysisJson)
  const parsedOptimized = fullAiResultSchema.shape.optimizedResume.safeParse(updated.optimizedJson)

  if (parsedAnalysis.success && parsedOptimized.success) {
    const diff = buildDiffPayload({
      resume: existing.resume,
      analysis: parsedAnalysis.data,
      optimizedResume: parsedOptimized.data,
      version: updated,
    })
    await prisma.optimizedVersion.update({
      where: { id: params.versionId },
      data: {
        snapshotJson: buildVersionSnapshot({
          resume: existing.resume,
          analysis: parsedAnalysis.data,
          optimizedResume: parsedOptimized.data,
          lapisMarkdown: params.input.markdown,
          diff,
        }),
      },
    })
  }

  return {
    versionId: updated.id,
    savedAt: updated.updatedAt.toISOString(),
  }
}

export async function listUserResumes(userId: string) {
  const resumes = await prisma.resume.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      versions: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      analyses: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  return {
    items: resumes.map((resume) => ({
      id: resume.id,
      title: titleFromResume(resume),
      sourceType: sourceTypeFromName(resume.originalName),
      createdAt: resume.createdAt.toISOString(),
      updatedAt: resume.updatedAt.toISOString(),
      latestVersionId: resume.versions[0]?.id,
      latestScore: resume.analyses[0]?.score,
    })),
  }
}

export async function listResumeHistory(userId: string) {
  const versions = await prisma.optimizedVersion.findMany({
    where: {
      deletedAt: null,
      resume: {
        userId,
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      resume: {
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    take: 50,
  })

  return {
    items: versions.map((version) => {
      const analysis = version.resume.analyses[0]
      const stats = analysis
        ? {
            total: 1,
            added: 0,
            optimized: 1,
            removed: 0,
          }
        : undefined

      return {
        resumeId: version.resumeId,
        versionId: version.id,
        title: titleFromResume(version.resume),
        targetRole: version.resume.targetJob,
        score: analysis?.score,
        stats,
        createdAt: version.createdAt.toISOString(),
      }
    }),
  }
}

export function normalizeTheme(theme: string): LapisTheme {
  return theme === 'lapis-cv-serif' ? 'lapis-cv-serif' : 'lapis-cv'
}
