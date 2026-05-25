import type { AnalyzeResumeResult } from '../types/api'
import type { AnalysisResult } from '../types/analysis'
import type {
  OptimizedResume,
  ResumeChange,
  ResumeDiffData,
  ResumeEditorSection,
  ResumePreviewData,
  ResumeSection,
} from '../types/resume'
import { placeholderAnalysis, placeholderOptimizedResume } from './placeholders'

type FlexibleSection = ResumeSection | string | Record<string, unknown>

const defaultOrder: Record<string, number> = {
  profile: 10,
  skills: 20,
  projects: 30,
  internships: 40,
  campusExperience: 50,
  education: 60,
  awards: 70,
}

const labelMap: Record<string, string> = {
  profile: '个人简介',
  skills: '技能清单',
  projects: '项目经历',
  internships: '实习经历',
  campusExperience: '校园经历',
  education: '教育经历',
  awards: '奖项证书',
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join('\n')
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.optimized ?? record.content ?? record.text ?? record.description ?? '')
  }
  return ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asText).filter(Boolean) : []
}

function normalizeSection(id: string, value: FlexibleSection, index = 0): ResumeEditorSection | null {
  const record = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
  const optimized = asText(record?.optimized ?? record?.content ?? record?.text ?? value)

  if (!optimized.trim()) return null

  return {
    id: String(record?.id ?? `${id}-${index}`).replace(/-0$/, ''),
    label: String(record?.label ?? record?.title ?? labelMap[id] ?? id),
    original: asText(record?.original ?? record?.before),
    optimized,
    reason: asText(record?.reason),
    items: asStringArray(record?.items),
    order: Number(record?.order ?? defaultOrder[id] ?? 100 + index),
  }
}

function fromArray(id: string, value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => normalizeSection(id, item as FlexibleSection, index))
    .filter((item): item is ResumeEditorSection => Boolean(item))
}

export function buildEditorSections(optimizedResume?: OptimizedResume): ResumeEditorSection[] {
  if (!optimizedResume) return placeholderOptimizedResume.editorSections ?? []
  if (optimizedResume.editorSections?.length) {
    return [...optimizedResume.editorSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  const sections = [
    normalizeSection('profile', optimizedResume.profile ?? ''),
    normalizeSection('skills', optimizedResume.skills ?? ''),
    ...fromArray('projects', optimizedResume.projects),
    ...fromArray('internships', optimizedResume.internships),
    ...fromArray('campusExperience', optimizedResume.campusExperience),
    normalizeSection('education', optimizedResume.education ?? ''),
    normalizeSection('awards', optimizedResume.awards ?? ''),
  ].filter((item): item is ResumeEditorSection => Boolean(item))

  return sections.length
    ? sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : placeholderOptimizedResume.editorSections ?? []
}

export function buildPreviewData(
  optimizedResume?: OptimizedResume,
  sections = buildEditorSections(optimizedResume),
): ResumePreviewData {
  if (!optimizedResume) {
    return placeholderOptimizedResume.preview ?? {
      name: '张同学',
      title: '应用型数据分析实习生',
      theme: 'lapis-cv',
      lines: [],
      isPlaceholder: true,
    }
  }
  if (optimizedResume.preview) return optimizedResume.preview

  const firstProfile = sections.find((section) => section.id.startsWith('profile'))?.optimized ?? ''
  const skills = sections.find((section) => section.id.startsWith('skills'))?.items
  return {
    name: '待补充姓名',
    title: firstProfile.slice(0, 18) || '优化版简历预览',
    theme: 'lapis-cv',
    lines: skills?.slice(0, 3) ?? sections.slice(0, 3).map((section) => section.label),
    isPlaceholder: !optimizedResume,
  }
}

function normalizeChanges(result?: AnalyzeResumeResult | null): ResumeChange[] {
  const changes = result?.diff?.changes
    ?? result?.changes
    ?? result?.optimizedResume?.diff?.changes
    ?? result?.optimizedResume?.changes
    ?? []

  return changes
    .map((change, index) => ({
      ...change,
      id: change.id || `change_${index + 1}`,
      order: change.order ?? index + 1,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

function normalizeValueExtraction(value: unknown): AnalysisResult['valueExtraction'] {
  if (!Array.isArray(value)) return []

  return value.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const original = asText(record.original ?? record.module ?? record.experience ?? record.before)
    const deliverable = asText(record.deliverable ?? record.output ?? record.currentProblem)
    const result = asText(record.result ?? record.impact)
    const missing = asText(record.missingQuantification ?? record.missing)
    const direction = asText(record.rewriteDirection ?? record.direction ?? record.suggestion)

    return {
      module: asText(record.module) || original || `经历模块 ${index + 1}`,
      currentProblem: [deliverable, result, missing].filter(Boolean).join('；') || asText(record.currentProblem) || '缺少可量化成果或业务影响描述',
      direction: direction || '按动作、产物、结果补强表达，并保留真实事实。',
    }
  }).filter((item) => item.module || item.currentProblem || item.direction)
}

function fallbackGradeFromScore(score: number) {
  if (score > 85) return '优秀'
  if (score > 70) return '良好'
  return '待优化'
}

function normalizeGrade(grade: unknown, score: number) {
  return grade === '优秀' || grade === '良好' || grade === '待优化'
    ? grade
    : fallbackGradeFromScore(score)
}

export function buildResumeDiff(result?: AnalyzeResumeResult | null): ResumeDiffData {
  if (!result) return placeholderOptimizedResume.diff as ResumeDiffData

  const optimized = result.optimizedResume
  const changes = normalizeChanges(result)
  const beforeMarkdown = result.diff?.beforeMarkdown
    ?? result.beforeMarkdown
    ?? optimized?.diff?.beforeMarkdown
    ?? optimized?.beforeMarkdown
    ?? ''
  const afterMarkdown = result.diff?.afterMarkdown
    ?? result.afterMarkdown
    ?? result.lapisMarkdown
    ?? optimized?.diff?.afterMarkdown
    ?? optimized?.afterMarkdown
    ?? optimized?.markdown
    ?? ''

  return {
    resumeId: result.resumeId,
    versionId: result.versionId,
    targetRole: result.diff?.targetRole ?? result.targetRole ?? optimized?.targetRole,
    beforeMarkdown,
    afterMarkdown,
    score: result.diff?.score
      ?? result.score
      ?? optimized?.diff?.score
      ?? optimized?.score
      ?? { before: Math.max((result.analysis?.score ?? 78) - 10, 0), after: result.analysis?.score ?? 78 },
    stats: result.diff?.stats
      ?? result.stats
      ?? optimized?.diff?.stats
      ?? optimized?.stats
      ?? {
        total: changes.length,
        added: changes.filter((item) => item.type === 'added').length,
        optimized: changes.filter((item) => item.type === 'optimized').length,
        removed: changes.filter((item) => item.type === 'removed').length,
      },
    summary: result.diff?.summary
      ?? result.summary
      ?? optimized?.diff?.summary
      ?? optimized?.summary
      ?? result.analysis?.summary
      ?? 'AI 已完成简历诊断和优化，建议重点核对每一处修改是否符合真实经历。',
    suggestions: result.diff?.suggestions
      ?? result.suggestions
      ?? optimized?.diff?.suggestions
      ?? optimized?.suggestions
      ?? [],
    changes,
  }
}

export function normalizeAnalysisResult(result?: AnalyzeResumeResult | null): AnalysisResult {
  if (!result?.analysis) return placeholderAnalysis
  const rawAnalysis = result.analysis as AnalysisResult & {
    mainProblems?: Array<{ priority?: AnalysisResult['issues'][number]['level']; problem?: string; suggestion?: string }>
    missingKeywords?: string[]
  }

  return {
    ...placeholderAnalysis,
    ...result.analysis,
    issues: rawAnalysis.issues ?? rawAnalysis.mainProblems?.map((item) => ({
      level: item.priority,
      text: item.problem,
      suggestion: item.suggestion,
    })) ?? placeholderAnalysis.issues,
    keywords: rawAnalysis.keywords ?? rawAnalysis.missingKeywords ?? placeholderAnalysis.keywords,
    valueExtraction: normalizeValueExtraction(rawAnalysis.valueExtraction),
    summary: rawAnalysis.summary ?? rawAnalysis.oneSentenceConclusion ?? placeholderAnalysis.summary,
    grade: normalizeGrade(rawAnalysis.grade, rawAnalysis.score),
    resumeId: result.resumeId,
    analysisId: result.analysisId,
    versionId: result.versionId,
    isPlaceholder: false,
  }
}

export function normalizeOptimizedResume(result?: AnalyzeResumeResult | null): OptimizedResume {
  if (!result?.optimizedResume && !result?.diff && !result?.afterMarkdown) return placeholderOptimizedResume

  const source = result.optimizedResume ?? {}
  const sections = buildEditorSections(source)
  const diff = buildResumeDiff(result)

  return {
    ...source,
    editorSections: sections,
    preview: buildPreviewData(source, sections),
    markdown: diff.afterMarkdown || result.lapisMarkdown || source.markdown,
    diff,
    beforeMarkdown: diff.beforeMarkdown,
    afterMarkdown: diff.afterMarkdown,
    score: diff.score,
    stats: diff.stats,
    summary: diff.summary,
    suggestions: diff.suggestions,
    changes: diff.changes,
    targetRole: diff.targetRole,
    isPlaceholder: false,
  }
}
