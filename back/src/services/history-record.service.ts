import type { OptimizedVersion, Resume, ResumeAnalysis } from '@prisma/client'
import { NotFoundError } from '../lib/domain-errors.js'
import { prisma } from '../lib/prisma.js'
import { toJson } from '../lib/json.js'
import { analysisSchema, fullAiResultSchema, type AnalysisResult } from '../schemas/ai.js'
import type { HistoryListQuery, HistoryRestoreInput } from '../schemas/history.js'
import { buildDiffPayload } from './resume-diff.service.js'

type VersionWithResume = OptimizedVersion & {
  resume: Resume
}

function sourceTypeFromName(name?: string | null): 'markdown' | 'text' | 'pdf' | 'docx' {
  const lower = name?.toLowerCase() ?? ''
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown'
  return 'text'
}

function titleFromResume(resume: Pick<Resume, 'originalName' | 'targetJob'>) {
  return resume.originalName?.replace(/\.[^.]+$/, '') || `${resume.targetJob}简历`
}

function snapshotObject(snapshot: unknown) {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? snapshot as Record<string, unknown>
    : undefined
}

function parseSnapshotAnalysis(snapshot: unknown) {
  const data = snapshotObject(snapshot)?.analysis
  const parsed = analysisSchema.safeParse(data)
  return parsed.success ? parsed.data : undefined
}

async function findAnalysisForVersion(version: OptimizedVersion) {
  return prisma.resumeAnalysis.findFirst({
    where: {
      resumeId: version.resumeId,
      createdAt: {
        lte: new Date(version.createdAt.getTime() + 1000),
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

async function analysisForVersion(version: OptimizedVersion) {
  const fromSnapshot = parseSnapshotAnalysis(version.snapshotJson)
  if (fromSnapshot) {
    return {
      id: undefined,
      data: fromSnapshot,
    }
  }

  const analysis = await findAnalysisForVersion(version)
  const parsed = analysisSchema.safeParse(analysis?.analysisJson)
  if (!parsed.success) {
    return undefined
  }

  return {
    id: analysis?.id,
    data: parsed.data,
  }
}

export function buildVersionSnapshot(params: {
  resume: Resume
  analysis: AnalysisResult
  optimizedResume: unknown
  lapisMarkdown: string
  diff: unknown
}) {
  return toJson({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    resume: {
      id: params.resume.id,
      originalName: params.resume.originalName,
      originalText: params.resume.originalText,
      targetJob: params.resume.targetJob,
      jobDescription: params.resume.jobDescription,
      jobStage: params.resume.jobStage,
      outputLanguage: params.resume.outputLanguage,
      optimizeLevel: params.resume.optimizeLevel,
      sourceType: sourceTypeFromName(params.resume.originalName),
    },
    analysis: params.analysis,
    optimizedResume: params.optimizedResume,
    lapisMarkdown: params.lapisMarkdown,
    diff: params.diff,
  })
}

function editorPayloadFrom(version: VersionWithResume) {
  const snapshotResume = snapshotObject(snapshotObject(version.snapshotJson)?.resume)
  return {
    sourceResumeId: version.resumeId,
    resumeText: String(snapshotResume?.originalText ?? version.resume.originalText),
    originalName: String(snapshotResume?.originalName ?? version.resume.originalName ?? ''),
    targetJob: String(snapshotResume?.targetJob ?? version.resume.targetJob),
    jobDescription: String(snapshotResume?.jobDescription ?? version.resume.jobDescription ?? ''),
    jobStage: String(snapshotResume?.jobStage ?? version.resume.jobStage),
    outputLanguage: String(snapshotResume?.outputLanguage ?? version.resume.outputLanguage),
    optimizeLevel: String(snapshotResume?.optimizeLevel ?? version.resume.optimizeLevel),
  }
}

function versionSummary(params: {
  version: VersionWithResume
  analysis?: { id?: string; data: AnalysisResult }
}) {
  const markdown = params.version.lapisMarkdown ?? ''
  const analysis = params.analysis?.data
  return {
    historyId: params.version.id,
    resumeId: params.version.resumeId,
    versionId: params.version.id,
    title: titleFromResume(params.version.resume),
    versionName: params.version.versionName,
    targetRole: params.version.resume.targetJob,
    sourceType: sourceTypeFromName(params.version.resume.originalName),
    score: analysis?.score,
    matchRate: analysis?.matchRate,
    summary: analysis?.oneSentenceConclusion,
    markdownPreview: markdown.replace(/\s+/g, ' ').trim().slice(0, 140),
    archived: Boolean(params.version.deletedAt),
    canRestore: true,
    restoredFromVersionId: params.version.restoredFromVersionId,
    createdAt: params.version.createdAt.toISOString(),
    updatedAt: params.version.updatedAt.toISOString(),
    deletedAt: params.version.deletedAt?.toISOString(),
  }
}

async function findOwnedVersion(versionId: string, userId: string) {
  const version = await prisma.optimizedVersion.findFirst({
    where: {
      id: versionId,
      resume: { userId },
    },
    include: { resume: true },
  })

  if (!version) {
    throw new NotFoundError('历史记录不存在或无权访问')
  }

  return version
}

export async function listHistoryRecords(userId: string, query: HistoryListQuery) {
  const items = await prisma.optimizedVersion.findMany({
    where: {
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      resume: {
        userId,
        ...(query.targetRole ? { targetJob: { contains: query.targetRole } } : {}),
        ...(query.q
          ? {
              OR: [
                { targetJob: { contains: query.q } },
                { originalName: { contains: query.q } },
              ],
            }
          : {}),
      },
    },
    orderBy: { createdAt: 'desc' },
    cursor: query.cursor ? { id: query.cursor } : undefined,
    skip: query.cursor ? 1 : 0,
    take: query.limit + 1,
    include: { resume: true },
  })

  const page = items.slice(0, query.limit)
  const analysisPairs = await Promise.all(page.map(async (version) => ({
    versionId: version.id,
    analysis: await analysisForVersion(version),
  })))
  const analysisByVersion = new Map(analysisPairs.map((item) => [item.versionId, item.analysis]))

  return {
    items: page.map((version) => versionSummary({
      version,
      analysis: analysisByVersion.get(version.id),
    })),
    pageInfo: {
      limit: query.limit,
      nextCursor: items.length > query.limit ? items[query.limit]?.id : null,
      hasMore: items.length > query.limit,
    },
  }
}

export async function getHistoryRecordDetail(versionId: string, userId: string) {
  const version = await findOwnedVersion(versionId, userId)
  const analysis = await analysisForVersion(version)
  const optimized = fullAiResultSchema.shape.optimizedResume.safeParse(version.optimizedJson)

  if (!analysis || !optimized.success) {
    throw new NotFoundError('历史记录数据不完整')
  }

  const diff = buildDiffPayload({
    resume: version.resume,
    analysis: analysis.data,
    optimizedResume: optimized.data,
    version,
  })

  return {
    ...versionSummary({ version, analysis }),
    analysisId: analysis.id,
    analysis: analysis.data,
    optimizedResume: {
      ...optimized.data,
      markdown: version.lapisMarkdown,
      diff,
    },
    diff,
    lapisMarkdown: version.lapisMarkdown,
    lapisTheme: version.lapisTheme,
    editorPayload: editorPayloadFrom(version),
    restoreOptions: {
      defaultMode: 'newVersion',
      modes: ['newVersion', 'newResume'],
      safeRestore: true,
    },
  }
}

export async function restoreHistoryRecord(params: {
  versionId: string
  userId: string
  input: HistoryRestoreInput
}) {
  const version = await findOwnedVersion(params.versionId, params.userId)
  const analysis = await analysisForVersion(version)
  if (!analysis) {
    throw new NotFoundError('历史记录分析数据不完整，无法恢复')
  }

  const versionName = params.input.versionName ?? `恢复自 ${version.versionName}`

  if (params.input.restoreMode === 'newResume') {
    const snapshotResume = snapshotObject(snapshotObject(version.snapshotJson)?.resume)
    const newResume = await prisma.resume.create({
      data: {
        userId: params.userId,
        originalName: String(snapshotResume?.originalName ?? version.resume.originalName ?? titleFromResume(version.resume)),
        originalText: String(snapshotResume?.originalText ?? version.resume.originalText),
        targetJob: String(snapshotResume?.targetJob ?? version.resume.targetJob),
        jobDescription: String(snapshotResume?.jobDescription ?? version.resume.jobDescription ?? ''),
        jobStage: String(snapshotResume?.jobStage ?? version.resume.jobStage),
        outputLanguage: String(snapshotResume?.outputLanguage ?? version.resume.outputLanguage),
        optimizeLevel: String(snapshotResume?.optimizeLevel ?? version.resume.optimizeLevel),
      },
    })

    const restoredVersion = await prisma.optimizedVersion.create({
      data: {
        resumeId: newResume.id,
        versionName,
        optimizedJson: toJson(version.optimizedJson),
        ...(version.snapshotJson === null ? {} : { snapshotJson: toJson(version.snapshotJson) }),
        lapisMarkdown: version.lapisMarkdown,
        lapisTheme: version.lapisTheme,
        skillName: version.skillName,
        skillVersion: version.skillVersion,
        promptVersion: version.promptVersion,
        restoredFromVersionId: version.id,
      },
    })

    await prisma.resumeAnalysis.create({
      data: {
        resumeId: newResume.id,
        score: analysis.data.score,
        matchRate: analysis.data.matchRate,
        analysisJson: toJson(analysis.data),
        skillName: version.skillName,
        skillVersion: version.skillVersion,
        promptVersion: version.promptVersion,
      },
    })

    return {
      restored: true,
      restoreMode: params.input.restoreMode,
      resumeId: newResume.id,
      versionId: restoredVersion.id,
      historyId: restoredVersion.id,
      restoredFromVersionId: version.id,
      editorPayload: {
        ...editorPayloadFrom({ ...restoredVersion, resume: newResume }),
        sourceResumeId: newResume.id,
      },
    }
  }

  const restoredVersion = await prisma.optimizedVersion.create({
    data: {
      resumeId: version.resumeId,
      versionName,
      optimizedJson: toJson(version.optimizedJson),
      ...(version.snapshotJson === null ? {} : { snapshotJson: toJson(version.snapshotJson) }),
      lapisMarkdown: version.lapisMarkdown,
      lapisTheme: version.lapisTheme,
      skillName: version.skillName,
      skillVersion: version.skillVersion,
      promptVersion: version.promptVersion,
      restoredFromVersionId: version.id,
    },
  })

  return {
    restored: true,
    restoreMode: params.input.restoreMode,
    resumeId: version.resumeId,
    versionId: restoredVersion.id,
    historyId: restoredVersion.id,
    restoredFromVersionId: version.id,
    editorPayload: editorPayloadFrom({ ...restoredVersion, resume: version.resume }),
  }
}

export async function archiveHistoryRecord(versionId: string, userId: string) {
  const version = await findOwnedVersion(versionId, userId)
  const updated = await prisma.optimizedVersion.update({
    where: { id: version.id },
    data: {
      deletedAt: version.deletedAt ?? new Date(),
    },
  })

  return {
    historyId: updated.id,
    archived: true,
    deletedAt: updated.deletedAt?.toISOString(),
  }
}

export async function unarchiveHistoryRecord(versionId: string, userId: string) {
  const version = await findOwnedVersion(versionId, userId)
  const updated = await prisma.optimizedVersion.update({
    where: { id: version.id },
    data: {
      deletedAt: null,
    },
  })

  return {
    historyId: updated.id,
    archived: false,
    updatedAt: updated.updatedAt.toISOString(),
  }
}
