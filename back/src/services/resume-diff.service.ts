import type { Resume } from '@prisma/client'
import type { AnalysisResult, OptimizedResumeResult } from '../schemas/ai.js'

type OptimizedVersionLike = {
  id: string
  lapisMarkdown: string | null
  optimizedJson: unknown
}

function trimSnippet(text: string, max = 180) {
  return text.replace(/\s+/g, ' ').trim().slice(0, max)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('；')
  if (value && typeof value === 'object') {
    const record = asRecord(value)
    return asText(record.optimized ?? record.content ?? record.text ?? record.description ?? record.title ?? '')
  }
  return ''
}

function changeType(before: string, after: string) {
  if (!before && after) return 'added' as const
  return 'optimized' as const
}

export function buildBeforeMarkdown(resume: Pick<Resume, 'originalName' | 'targetJob' | 'originalText'>) {
  const title = resume.originalName?.replace(/\.[^.]+$/, '') || resume.targetJob || 'resume'
  return `# ${title}\n\n${resume.originalText.trim()}`
}

export function buildDiffPayload(params: {
  resume: Pick<Resume, 'id' | 'originalName' | 'targetJob' | 'originalText'>
  analysis: Pick<AnalysisResult, 'score' | 'actionItems' | 'oneSentenceConclusion'>
  optimizedResume: OptimizedResumeResult
  version: OptimizedVersionLike
}) {
  const beforeMarkdown = buildBeforeMarkdown(params.resume)
  const afterMarkdown = params.version.lapisMarkdown ?? ''
  const source = params.optimizedResume
  const changes = [
    {
      sectionId: 'profile',
      section: '个人简介',
      title: '重写个人简介',
      before: source.profile.original,
      after: source.profile.optimized,
      reason: source.profile.reason,
      impact: '让岗位定位更清晰',
    },
    {
      sectionId: 'skills',
      section: '技能栈',
      title: '重组技能关键词',
      before: '',
      after: source.skills.optimized.join('；'),
      reason: source.skills.reason,
      impact: '提升关键词覆盖和可读性',
    },
    ...source.projects.map((project, index) => ({
      sectionId: `project-${index + 1}`,
      section: '项目经历',
      title: project.title,
      before: project.original,
      after: project.optimizedBullets.join('；'),
      reason: project.reason,
      impact: '突出动作、产物和结果',
    })),
    ...source.internships.map((item, index) => {
      const record = asRecord(item)
      return {
        sectionId: `internship-${index + 1}`,
        section: '实习经历',
        title: asText(record.title ?? record.name) || `实习经历 ${index + 1}`,
        before: asText(record.original ?? record.before),
        after: asText(record.optimizedBullets ?? record.bullets ?? record.items ?? record.content),
        reason: asText(record.reason) || '保留原始实习事实并优化表达。',
        impact: '增强经历可信度和岗位匹配度',
      }
    }),
    ...source.campusExperience.map((item, index) => {
      const record = asRecord(item)
      return {
        sectionId: `campus-${index + 1}`,
        section: '校园经历',
        title: asText(record.title ?? record.name) || `校园经历 ${index + 1}`,
        before: asText(record.original ?? record.before),
        after: asText(record.optimizedBullets ?? record.bullets ?? record.items ?? record.content),
        reason: asText(record.reason) || '保留原始校园经历并优化表达。',
        impact: '补充可迁移能力证据',
      }
    }),
  ]
    .filter((item) => trimSnippet(item.after, 20))
    .map((item, index) => {
      const before = trimSnippet(item.before)
      const after = trimSnippet(item.after)
      return {
        id: `change_${params.version.id}_${index + 1}`,
        resumeId: params.resume.id,
        versionId: params.version.id,
        sectionId: item.sectionId,
        section: item.section,
        type: changeType(before, after),
        title: item.title,
        before,
        after,
        reason: item.reason,
        impact: item.impact,
        startIndex: before ? beforeMarkdown.indexOf(before) : -1,
        endIndex: before ? beforeMarkdown.indexOf(before) + before.length : -1,
        order: index + 1,
      }
    })

  return {
    resumeId: params.resume.id,
    versionId: params.version.id,
    targetRole: params.resume.targetJob,
    beforeMarkdown,
    afterMarkdown,
    score: {
      before: Math.max(params.analysis.score - 12, 0),
      after: params.analysis.score,
    },
    stats: {
      total: changes.length,
      added: changes.filter((item) => item.type === 'added').length,
      optimized: changes.filter((item) => item.type === 'optimized').length,
      removed: 0,
    },
    summary: params.analysis.oneSentenceConclusion,
    suggestions: params.analysis.actionItems,
    changes,
  }
}
