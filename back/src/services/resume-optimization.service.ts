import type { OptimizedVersion, Resume, ResumeAnalysis } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { toJson } from '../lib/json.js'
import { fullAiResultSchema, type FullAiResult } from '../schemas/ai.js'
import type { AnalyzeResumeInput, OptimizeResumeInput } from '../schemas/resume.js'
import { analyzeAndOptimizeResume, promptVersions } from './ai.service.js'
import {
  assertHasRemainingUsage,
  incrementUsage,
  type UsageIdentity,
} from './usage.service.js'
import {
  RESUME_OPTIMIZER_SKILL_NAME,
  RESUME_OPTIMIZER_SKILL_VERSION,
} from './skill.service.js'
import { buildDiffPayload } from './resume-diff.service.js'
import { buildVersionSnapshot } from './history-record.service.js'

export type OptimizationProgress = {
  stage: 'checking_usage' | 'loading_resume' | 'calling_ai' | 'saving_version' | 'done'
  progress: number
  message: string
}

type ProgressCallback = (event: OptimizationProgress) => void

function buildResponse(params: {
  resume: Resume
  analysis: ResumeAnalysis
  version: OptimizedVersion
  usage: Awaited<ReturnType<typeof incrementUsage>>
  validated: FullAiResult
}) {
  const diff = buildDiffPayload({
    resume: params.resume,
    analysis: params.validated.analysis,
    optimizedResume: params.validated.optimizedResume,
    version: params.version,
  })

  return {
    resumeId: params.resume.id,
    analysisId: params.analysis.id,
    versionId: params.version.id,
    remaining: params.usage.remaining,
    usage: params.usage,
    analysis: params.validated.analysis,
    optimizedResume: {
      ...params.validated.optimizedResume,
      markdown: params.validated.lapisMarkdown,
      diff,
      beforeMarkdown: diff.beforeMarkdown,
      afterMarkdown: diff.afterMarkdown,
      score: diff.score,
      stats: diff.stats,
      summary: diff.summary,
      suggestions: diff.suggestions,
      changes: diff.changes,
      targetRole: diff.targetRole,
    },
    diff,
    beforeMarkdown: diff.beforeMarkdown,
    afterMarkdown: diff.afterMarkdown,
    score: diff.score,
    stats: diff.stats,
    summary: diff.summary,
    suggestions: diff.suggestions,
    changes: diff.changes,
    lapisMarkdown: params.validated.lapisMarkdown,
    targetRole: params.resume.targetJob,
  }
}

async function createOptimizationRecords(resumeId: string, validated: FullAiResult) {
  return prisma.$transaction([
    prisma.resumeAnalysis.create({
      data: {
        resumeId,
        score: validated.analysis.score,
        matchRate: validated.analysis.matchRate,
        analysisJson: toJson(validated.analysis),
        skillName: RESUME_OPTIMIZER_SKILL_NAME,
        skillVersion: RESUME_OPTIMIZER_SKILL_VERSION,
        promptVersion: promptVersions.analysis,
      },
    }),
    prisma.optimizedVersion.create({
      data: {
        resumeId,
        versionName: 'AI optimized version',
        optimizedJson: toJson(validated.optimizedResume),
        lapisMarkdown: validated.lapisMarkdown,
        lapisTheme: 'lapis-cv',
        skillName: RESUME_OPTIMIZER_SKILL_NAME,
        skillVersion: RESUME_OPTIMIZER_SKILL_VERSION,
        promptVersion: promptVersions.optimize,
      },
    }),
  ])
}

export async function createResumeOptimization(input: AnalyzeResumeInput, identity: UsageIdentity) {
  await assertHasRemainingUsage(identity)

  const resume = await prisma.resume.create({
    data: {
      userId: identity.userId,
      originalName: input.originalName,
      originalText: input.resumeText,
      targetJob: input.targetJob,
      jobDescription: input.jobDescription,
      jobStage: input.jobStage,
      outputLanguage: input.outputLanguage,
      optimizeLevel: input.optimizeLevel,
    },
  })

  const aiResult = await analyzeAndOptimizeResume(input)
  const validated = fullAiResultSchema.parse(aiResult)
  const [analysis, version] = await createOptimizationRecords(resume.id, validated)
  const usage = await incrementUsage(identity)
  const response = buildResponse({ resume, analysis, version, usage, validated })
  await prisma.optimizedVersion.update({
    where: { id: version.id },
    data: {
      snapshotJson: buildVersionSnapshot({
        resume,
        analysis: validated.analysis,
        optimizedResume: validated.optimizedResume,
        lapisMarkdown: validated.lapisMarkdown,
        diff: response.diff,
      }),
    },
  })

  return response
}

export async function optimizeExistingResume(params: {
  resumeId: string
  userId: string
  input: OptimizeResumeInput
  onProgress?: ProgressCallback
}) {
  params.onProgress?.({
    stage: 'checking_usage',
    progress: 8,
    message: '正在校验今日免费次数',
  })
  await assertHasRemainingUsage({ userId: params.userId })

  params.onProgress?.({
    stage: 'loading_resume',
    progress: 16,
    message: '正在读取并整理简历内容',
  })
  const resume = await prisma.resume.findFirst({
    where: {
      id: params.resumeId,
      userId: params.userId,
    },
  })

  if (!resume) {
    return null
  }

  const updatedResume = await prisma.resume.update({
    where: { id: resume.id },
    data: {
      targetJob: params.input.targetRole,
      jobDescription: params.input.targetJD,
      jobStage: params.input.jobStage,
      outputLanguage: params.input.outputLanguage,
      optimizeLevel: params.input.optimizeLevel,
    },
  })

  const aiInput: AnalyzeResumeInput = {
    resumeText: updatedResume.originalText,
    targetJob: params.input.targetRole,
    jobDescription: params.input.targetJD,
    jobStage: params.input.jobStage,
    outputLanguage: params.input.outputLanguage,
    optimizeLevel: params.input.optimizeLevel,
    originalName: updatedResume.originalName ?? undefined,
  }
  params.onProgress?.({
    stage: 'calling_ai',
    progress: 38,
    message: '正在调用 AI 生成结构化优化结果',
  })
  const aiResult = await analyzeAndOptimizeResume(aiInput)
  const validated = fullAiResultSchema.parse(aiResult)
  params.onProgress?.({
    stage: 'saving_version',
    progress: 82,
    message: '正在保存优化版本和历史快照',
  })
  const [analysis, version] = await createOptimizationRecords(updatedResume.id, validated)
  const usage = await incrementUsage({ userId: params.userId })
  const response = buildResponse({ resume: updatedResume, analysis, version, usage, validated })
  await prisma.optimizedVersion.update({
    where: { id: version.id },
    data: {
      snapshotJson: buildVersionSnapshot({
        resume: updatedResume,
        analysis: validated.analysis,
        optimizedResume: validated.optimizedResume,
        lapisMarkdown: validated.lapisMarkdown,
        diff: response.diff,
      }),
    },
  })
  params.onProgress?.({
    stage: 'done',
    progress: 100,
    message: '优化完成',
  })

  return response
}
