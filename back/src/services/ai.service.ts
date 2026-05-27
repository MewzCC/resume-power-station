import { buildAnalysisPrompt, ANALYSIS_PROMPT_VERSION } from '../../prompts/analysis.zh.js'
import { buildFastOptimizePrompt, FAST_OPTIMIZE_PROMPT_VERSION } from '../../prompts/optimize-fast.zh.js'
import { buildOptimizePrompt, OPTIMIZE_PROMPT_VERSION } from '../../prompts/optimize.zh.js'
import { buildSegmentPrompt, SEGMENT_PROMPT_VERSION } from '../../prompts/segment.zh.js'
import { env } from '../lib/env.js'
import { gradeFromScore } from '../lib/grade.js'
import {
  analysisSchema,
  fullAiResultSchema,
  optimizedResumeSchema,
  resumeSegmentResultSchema,
  type FullAiResult,
  type ResumeSegment,
  type ResumeSegmentResult,
  type ResumeSegmentType,
} from '../schemas/ai.js'
import type { AnalyzeResumeInput, SegmentResumeInput } from '../schemas/resume.js'
import { safeJsonParse } from './json.service.js'
import { renderOptimizedResumeMarkdown } from './resume-render.service.js'
import { loadResumeOptimizerSkill } from './skill.service.js'

type UnknownRecord = Record<string, unknown>

export class AiError extends Error {
  code: 'AI_FAILED' | 'AI_JSON_INVALID' | 'REQUEST_TIMEOUT'

  constructor(code: AiError['code'], message: string) {
    super(message)
    this.code = code
  }
}

async function callChatModel(params: {
  model: string
  system: string
  user: string
  temperature?: number
  timeoutMs?: number
  maxTokens?: number
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? env.aiRequestTimeoutMs)
  const maxTokens = params.maxTokens ?? env.aiMaxOutputTokens
  const tokenLimit = maxTokens > 0 ? { max_tokens: maxTokens } : {}

  const response = await fetch(`${env.openAiBaseUrl}/chat/completions`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      temperature: params.temperature ?? 0.2,
      ...tokenLimit,
      response_format: { type: 'json_object' },
    }),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AiError('REQUEST_TIMEOUT', `AI request timeout after ${params.timeoutMs ?? env.aiRequestTimeoutMs}ms`)
    }
    throw error
  }).finally(() => clearTimeout(timeout))

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new AiError(
      'AI_FAILED',
      `AI request failed: ${response.status}${errorText ? ` ${errorText.slice(0, 500)}` : ''}`,
    )
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new AiError('AI_FAILED', 'AI 返回为空')
  }
  return content
}

function buildSystemPrompt(skill: string) {
  return `你是面向大学生的 AI 简历优化助手。
你必须严格遵守以下内置 skill：

${skill}

额外要求：
- 项目初衷是免费帮助大学生。
- 不制造焦虑。
- 不编造经历。
- 缺失信息必须使用【待补充】占位符。
- 不输出会员、购买次数、付费导出、付费解锁等文案。`
}

function buildFastSystemPrompt() {
  return `你是资深简历优化专家。你只能优化用户已有经历的表达，不得编造事实。
禁止编造公司、学校、工作经历、项目、证书、时间和具体数字。
原始简历中已经存在的信息必须尽量保留，优化是在原事实基础上重组表达，而不是删减经历。
缺失信息必须写【待补充】。
只输出合法 JSON，不输出 Markdown，不输出解释。`
}

function compactInput(input: AnalyzeResumeInput): AnalyzeResumeInput {
  return {
    ...input,
    resumeText: input.resumeText.slice(0, env.aiMaxResumeChars),
    jobDescription: input.jobDescription.slice(0, env.aiMaxJdChars),
  }
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    if (Number.isFinite(parsed)) return Math.round(parsed)
  }
  return fallback
}

function clampScore(value: unknown, fallback: number) {
  return Math.max(0, Math.min(100, asNumber(value, fallback)))
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item
      const record = asRecord(item)
      return asString(record.text ?? record.content ?? record.name ?? record.title ?? record.value)
    }).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(/\n|；|;/).map((item) => item.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
  }
  return []
}

function normalizeAnalysis(value: unknown) {
  const record = asRecord(value)
  const score = clampScore(record.score, 72)
  const problems = Array.isArray(record.mainProblems ?? record.problems ?? record.issues)
    ? record.mainProblems ?? record.problems ?? record.issues
    : []
  const valueExtraction = Array.isArray(record.valueExtraction ?? record.highlights)
    ? record.valueExtraction ?? record.highlights
    : []

  return analysisSchema.parse({
    oneSentenceConclusion: asString(
      record.oneSentenceConclusion ?? record.summary ?? record.conclusion,
      'AI 已完成简历诊断和结构化优化。',
    ),
    score,
    matchRate: clampScore(record.matchRate ?? record.match_rate, 65),
    grade: gradeFromScore(score),
    mainProblems: (problems as unknown[]).slice(0, 3).map((item) => {
      const problem = asRecord(item)
      const priority = asString(problem.priority ?? problem.level, 'medium')
      return {
        problem: asString(problem.problem ?? problem.text ?? problem.title, '简历表达需要进一步聚焦目标岗位。'),
        impact: asString(problem.impact, '影响岗位匹配度和信息读取效率。'),
        suggestion: asString(problem.suggestion ?? problem.advice, '建议补充真实指标并强化岗位关键词。'),
        priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
      }
    }),
    valueExtraction: (valueExtraction as unknown[]).slice(0, 3).map((item) => {
      const valueItem = asRecord(item)
      return {
        original: asString(valueItem.original ?? valueItem.before, '原始经历描述'),
        deliverable: asString(valueItem.deliverable ?? valueItem.output, '可交付成果【待补充】'),
        result: asString(valueItem.result, '结果指标【待补充】'),
        missingQuantification: asString(valueItem.missingQuantification ?? valueItem.missing, '建议补充真实量化指标'),
        rewriteDirection: asString(valueItem.rewriteDirection ?? valueItem.direction, '按动作、产物、结果重写。'),
      }
    }),
    missingKeywords: asStringArray(record.missingKeywords ?? record.keywords).slice(0, 8),
    questionsToAsk: asStringArray(record.questionsToAsk ?? record.questions).slice(0, 6),
    actionItems: asStringArray(record.actionItems ?? record.suggestions ?? record.actions).slice(0, 6),
  })
}

function normalizeProfile(value: unknown) {
  const record = asRecord(value)
  if (typeof value === 'string') {
    return {
      original: '',
      optimized: value,
      reason: '优化个人简介表达。',
      needsUserInput: [],
    }
  }

  return {
    original: asString(record.original ?? record.before),
    optimized: asString(record.optimized ?? record.content ?? record.text ?? record.summary, '个人简介【待补充】'),
    reason: asString(record.reason, '围绕目标岗位强化表达。'),
    needsUserInput: asStringArray(record.needsUserInput ?? record.needUserInput),
  }
}

function normalizeSkills(value: unknown) {
  const record = asRecord(value)
  const optimized = asStringArray(Array.isArray(value) || typeof value === 'string'
    ? value
    : record.optimized ?? record.items ?? record.skills ?? record.content)

  return {
    optimized: optimized.length ? optimized : ['技能栈【待补充】'],
    reason: asString(record.reason, '按岗位相关性整理技能。'),
  }
}

function normalizeProject(value: unknown, index: number) {
  const record = asRecord(value)
  const bullets = asStringArray(
    record.optimizedBullets
      ?? record.bullets
      ?? record.items
      ?? record.achievements
      ?? record.responsibilities
      ?? record.content,
  )

  if (typeof value === 'string') {
    return {
      title: `项目经历 ${index + 1}`,
      context: '项目背景【待补充】',
      original: value,
      optimizedBullets: [value],
      reason: '将项目经历改写为简历 bullet。',
      needsUserInput: [],
    }
  }

  return {
    title: asString(record.title ?? record.name, `项目经历 ${index + 1}`),
    context: asString(record.context ?? record.description ?? record.background, '项目背景【待补充】'),
    original: asString(record.original ?? record.before),
    optimizedBullets: bullets.length ? bullets : ['项目贡献和真实结果【待补充】'],
    reason: asString(record.reason, '补充上下文并突出动作、产物和结果。'),
    needsUserInput: asStringArray(record.needsUserInput ?? record.needUserInput),
  }
}

function normalizeOptimizedResume(value: unknown) {
  const record = asRecord(value)
  const rawProjects = record.projects ?? record.projectExperience ?? record.experiences ?? record.workExperience
  const rawInternships = record.internships ?? record.internshipExperience
  const rawCampusExperience = record.campusExperience ?? record.campus ?? record.activities
  const projects = Array.isArray(rawProjects)
    ? rawProjects.slice(0, 6).map(normalizeProject)
    : []
  const internships = Array.isArray(rawInternships)
    ? rawInternships.slice(0, 6).map(normalizeProject)
    : []
  const campusExperience = Array.isArray(rawCampusExperience)
    ? rawCampusExperience.slice(0, 6).map(normalizeProject)
    : []

  return optimizedResumeSchema.parse({
    profile: normalizeProfile(record.profile ?? record.summary ?? record.personalSummary),
    skills: normalizeSkills(record.skills ?? record.skillSet),
    projects,
    internships,
    campusExperience,
    additionalSuggestions: asStringArray(record.additionalSuggestions ?? record.suggestions).slice(0, 6),
  })
}

function normalizeFastResult(value: unknown) {
  const record = asRecord(value)
  const analysis = normalizeAnalysis(record.analysis ?? record.diagnosis ?? record.review)
  const optimizedResume = normalizeOptimizedResume(record.optimizedResume ?? record.resume ?? record.optimized ?? record.data)

  return fullAiResultSchema.parse({
    analysis,
    optimizedResume,
    lapisMarkdown: renderOptimizedResumeMarkdown({
      resumeText: '',
      targetJob: '',
      jobDescription: '',
      jobStage: 'other',
      outputLanguage: 'zh',
      optimizeLevel: 'standard',
    }, optimizedResume),
  })
}

const segmentTitleByType: Record<ResumeSegmentType, string> = {
  basic: '基本信息',
  intention: '求职意向',
  education: '教育经历',
  skills: '专业技能',
  work: '工作经历',
  internship: '实习经历',
  project: '项目经历',
  campus: '校园经历',
  awards: '获奖与证书',
  research: '科研经历',
  summary: '自我评价',
  other: '未分组内容',
}

function normalizedSegmentTitle(section: Pick<ResumeSegment, 'title' | 'type'>) {
  const title = section.title.trim().replace(/[【】#]/g, '')
  return title || segmentTitleByType[section.type]
}

function formatSegmentedResumeText(sections: ResumeSegment[]) {
  return sections
    .map((section) => `【${normalizedSegmentTitle(section)}】\n${section.content.trim()}`)
    .join('\n\n')
    .trim()
}

function normalizeSegmentResult(value: unknown): ResumeSegmentResult {
  const parsed = resumeSegmentResultSchema.safeParse(value)
  if (!parsed.success) {
    throw new AiError('AI_JSON_INVALID', 'AI 分块返回格式异常，请稍后重试')
  }

  const sections = parsed.data.sections
    .map((section) => ({
      ...section,
      title: normalizedSegmentTitle(section),
      content: section.content.trim(),
    }))
    .filter((section) => section.content.length > 0)

  if (!sections.length) {
    throw new AiError('AI_JSON_INVALID', 'AI 分块结果为空，请稍后重试')
  }

  return {
    sections,
    warnings: parsed.data.warnings,
    text: formatSegmentedResumeText(sections),
  }
}

export async function segmentResumeText(input: SegmentResumeInput): Promise<ResumeSegmentResult> {
  const compact = {
    ...input,
    resumeText: input.resumeText.slice(0, env.aiMaxResumeChars),
  }

  if (env.mockAi) {
    throw new AiError('AI_FAILED', 'MOCK_AI 模式不支持 AI 简历分块，请配置真实 AI Key 后重试')
  }

  const raw = await callChatModel({
    model: env.fastOptimizeModel,
    system: '你是简历解析专家，只负责把解析出的简历纯文本分块整理为合法 JSON，不优化、不编造、不删除事实。',
    user: buildSegmentPrompt(compact),
    temperature: 0.05,
    timeoutMs: env.aiRequestTimeoutMs,
    maxTokens: env.aiMaxOutputTokens,
  })

  return normalizeSegmentResult(safeJsonParse<Record<string, unknown>>(raw))
}

async function fastAnalyzeAndOptimizeResume(input: AnalyzeResumeInput): Promise<FullAiResult> {
  const compact = compactInput(input)
  const raw = await callChatModel({
    model: env.fastOptimizeModel,
    system: buildFastSystemPrompt(),
    user: buildFastOptimizePrompt(compact),
    temperature: 0.15,
    timeoutMs: env.aiRequestTimeoutMs,
    maxTokens: env.aiMaxOutputTokens,
  })
  const normalized = normalizeFastResult(safeJsonParse<Record<string, unknown>>(raw))
  const analysis = normalized.analysis
  const optimizedResume = normalized.optimizedResume
  const lapisMarkdown = renderOptimizedResumeMarkdown(compact, optimizedResume)

  return fullAiResultSchema.parse({
    analysis,
    optimizedResume,
    lapisMarkdown,
  })
}

export async function analyzeAndOptimizeResume(input: AnalyzeResumeInput): Promise<FullAiResult> {
  if (env.mockAi) {
    return mockAiResult(input)
  }

  try {
    if (env.aiFastMode) {
      return await fastAnalyzeAndOptimizeResume(input)
    }

    const skill = await loadResumeOptimizerSkill()
    const system = buildSystemPrompt(skill)
    const analysisRaw = await callChatModel({
      model: env.analysisModel,
      system,
      user: buildAnalysisPrompt(input),
      timeoutMs: env.aiRequestTimeoutMs,
    })
    const analysis = normalizeAnalysis(safeJsonParse(analysisRaw))

    const optimizeRaw = await callChatModel({
      model: env.optimizeModel,
      system,
      user: buildOptimizePrompt(input, analysis),
      timeoutMs: env.aiRequestTimeoutMs,
    })
    const optimizeJson = safeJsonParse<Record<string, unknown>>(optimizeRaw)
    const lapisMarkdown = String(optimizeJson.lapisMarkdown ?? '')
    const optimizedResume = optimizedResumeSchema.parse(optimizeJson)

    return fullAiResultSchema.parse({
      analysis,
      optimizedResume,
      lapisMarkdown,
    })
  } catch (error) {
    if (error instanceof AiError) {
      throw error
    }
    throw new AiError(
      'AI_JSON_INVALID',
      error instanceof Error ? error.message : 'AI JSON 校验失败',
    )
  }
}

export const promptVersions = {
  analysis: ANALYSIS_PROMPT_VERSION,
  optimize: env.aiFastMode ? FAST_OPTIMIZE_PROMPT_VERSION : OPTIMIZE_PROMPT_VERSION,
  segment: SEGMENT_PROMPT_VERSION,
}

function mockAiResult(input: AnalyzeResumeInput): FullAiResult {
  const targetJob = input.targetJob.trim()
  const firstLine = input.resumeText.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim()
  const name = firstLine && firstLine.length <= 20 ? firstLine : '姓名【待补充】'

  const analysis = {
    oneSentenceConclusion: `这份简历具备基础经历，但需要围绕「${targetJob}」补强项目上下文、关键词和量化结果。`,
    score: 72,
    matchRate: input.jobDescription ? 68 : 55,
    grade: gradeFromScore(72),
    mainProblems: [
      {
        problem: '项目经历偏职责描述，缺少业务场景和可验证产物。',
        impact: '面试官难以判断你真实交付了什么，也难以把经历映射到岗位要求。',
        suggestion: '每个项目先补一句系统定位，再把 bullet 改成动作、产物、结果。',
        priority: 'high' as const,
      },
      {
        problem: '量化结果不足。',
        impact: '“优化、参与、负责”缺少证据，竞争力会被削弱。',
        suggestion: '补充性能、规模、频率、用户量、效率提升或流程缩短等指标；没有准确数字时用【待补充】。',
        priority: 'medium' as const,
      },
    ],
    valueExtraction: [
      {
        original: '原简历中的项目/实习描述',
        deliverable: '可沉淀为系统、组件、看板、脚本、流程或文档规范',
        result: '结果需要用户补充真实指标',
        missingQuantification: '【待补充：使用人数、耗时变化、性能指标、业务转化或风险降低】',
        rewriteDirection: `优先突出与「${targetJob}」相关的技术栈、业务问题和交付产物。`,
      },
    ],
    missingKeywords: input.jobDescription
      ? ['岗位 JD 关键词【待从 JD 中核对】', '项目上下文', '量化指标']
      : ['建议补充目标岗位 JD', '项目上下文', '量化指标'],
    questionsToAsk: [
      '项目服务的用户或业务对象是谁？',
      '你独立负责了哪些模块或产物？',
      '有没有性能、效率、规模、频率或转化指标？',
    ],
    actionItems: [
      '先为每个项目补一句项目描述。',
      '把“负责/参与”替换为具体动作和交付物。',
      '补充 2 到 3 个真实量化指标，无法确定时保留【待补充】。',
    ],
  }

  const optimizedResume = {
    profile: {
      original: '',
      optimized: `面向「${targetJob}」方向，具备【待补充：核心技术栈】与项目实践基础，能够围绕业务问题完成需求拆解、方案实现和结果复盘。`,
      reason: '将泛泛的自我评价改为岗位导向表达，并保留待补充事实。',
      needsUserInput: ['核心技术栈', '最相关项目名称', '真实量化结果'],
    },
    skills: {
      optimized: ['编程语言：【待补充】', '工程能力：【待补充】', `岗位关键词：${targetJob}`],
      reason: '技能清单需要按岗位分组，避免简单堆砌。',
    },
    projects: [
      {
        title: '项目名称【待补充】',
        context: `【项目描述待补充：面向 XX 用户的 XX 系统，用于支撑「${targetJob}」相关场景】`,
        original: '原项目描述',
        optimizedBullets: [
          '基于【待补充：技术栈】实现【待补充：核心模块】，交付【待补充：系统/组件/工具】，支持【待补充：业务场景】。',
          '梳理【待补充：流程/指标】并完成【待补充：优化动作】，将【待补充：指标】从【待补充】优化到【待补充】。',
        ],
        reason: '补足上下文，并把描述转成动作、产物、结果结构。',
        needsUserInput: ['项目服务对象', '你的角色', '真实指标'],
      },
    ],
    internships: [],
    campusExperience: [],
    additionalSuggestions: ['补充目标 JD 后可进一步做关键词裁剪。'],
  }

  const lapisMarkdown = `# ${name}

> 电话【待补充】 ｜ 邮箱【待补充】 ｜ 城市【待补充】 ｜ GitHub【待补充】

## 求职意向

${targetJob}

## 教育经历

### 学校名称【待补充】 ｜ 专业【待补充】
时间：【待补充】

- GPA：【待补充】
- 相关课程：【待补充】

## 技能栈

- 编程语言：【待补充】
- 技术框架：【待补充】
- 工程工具：【待补充】
- 岗位关键词：${targetJob}

## 项目经历

### 项目名称【待补充】 ｜ 角色【待补充】

【项目描述待补充：面向 XX 用户的 XX 系统，用于解决 XX 问题】

- 基于【待补充：技术栈】实现【待补充：核心模块】，交付【待补充：系统/组件/工具】，支持【待补充：业务场景】。
- 梳理【待补充：流程/指标】并完成【待补充：优化动作】，将【待补充：指标】从【待补充】优化到【待补充】。

## 实习 / 校园经历

### 组织/公司【待补充】 ｜ 职位【待补充】
时间：【待补充】

- 动作 + 产物 + 结果【待补充】。

## 获奖与证书

- 奖项或证书【待补充】
`

  return fullAiResultSchema.parse({
    analysis,
    optimizedResume,
    lapisMarkdown,
  })
}
