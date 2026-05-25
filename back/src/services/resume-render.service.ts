import type { AnalyzeResumeInput } from '../schemas/resume.js'
import type { OptimizedResumeResult } from '../schemas/ai.js'

type SectionLike = {
  title?: string
  name?: string
  context?: string
  description?: string
  original?: string
  optimizedBullets?: string[]
  bullets?: string[]
  items?: string[]
}

function firstResumeLine(text: string) {
  const line = text.split(/\r?\n/).find((item) => item.trim().length > 0)?.trim()
  return line && line.length <= 30 ? line : '姓名【待补充】'
}

function bullet(text: string) {
  return `- ${text.replace(/^[-*]\s*/, '').trim()}`
}

function asSection(value: unknown): SectionLike {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SectionLike : {}
}

function renderExperienceSection(value: unknown, index: number, fallbackTitle: string) {
  const section = asSection(value)
  const title = section.title || section.name || `${fallbackTitle} ${index + 1}`
  const context = section.context || section.description || ''
  const bullets = section.optimizedBullets ?? section.bullets ?? section.items ?? []
  const original = section.original?.trim()
  const renderedBullets = bullets.length
    ? bullets.map(bullet).join('\n')
    : original
      ? bullet(original)
      : '- 【待补充：职责、动作、产物和真实结果】'

  return `### ${title}

${context || '【待补充：背景/职责范围】'}

${renderedBullets}`
}

function renderExperienceList(values: unknown[], fallbackTitle: string, empty: string) {
  if (!values.length) return empty
  return values.map((item, index) => renderExperienceSection(item, index, fallbackTitle)).join('\n\n')
}

function preservedOriginalAppendix(input: AnalyzeResumeInput, afterMarkdown: string) {
  const compactOriginal = input.resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)
    .join('\n')
  if (!compactOriginal) return ''

  const originalTokens = compactOriginal
    .split(/\s+|，|。|；|;|、/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4)
  const preservedEnough = originalTokens.some((token) => afterMarkdown.includes(token))
  if (preservedEnough) return ''

  return `\n\n## 原始经历保留区（请核对归类）\n\n${compactOriginal
    .split(/\r?\n/)
    .map((line) => `- ${line}`)
    .join('\n')}`
}

export function renderOptimizedResumeMarkdown(input: AnalyzeResumeInput, resume: OptimizedResumeResult) {
  const name = firstResumeLine(input.resumeText)
  const skills = resume.skills.optimized.length
    ? resume.skills.optimized.map(bullet).join('\n')
    : '- 【待补充：技能栈】'
  const projects = resume.projects.length
    ? resume.projects.map((project, index) => renderExperienceSection(project, index, '项目经历')).join('\n\n')
    : `### 项目名称【待补充】

【待补充：项目背景】

- 【待补充：项目贡献和真实结果】`
  const internships = renderExperienceList(
    resume.internships,
    '实习经历',
    '- 【待补充：实习经历、测试/开发职责和真实结果】',
  )
  const campusExperience = renderExperienceList(
    resume.campusExperience,
    '校园经历',
    '- 【待补充：校园经历或相关活动】',
  )

  const suggestions = resume.additionalSuggestions.length
    ? `\n\n## 后续补充建议\n\n${resume.additionalSuggestions.map(bullet).join('\n')}`
    : ''

  const markdown = `# ${name}

> 电话【待补充】 ｜ 邮箱【待补充】 ｜ 城市【待补充】

## 求职意向

${input.targetJob}

## 个人简介

${resume.profile.optimized}

## 技能栈

${skills}

## 项目经历

${projects}

## 教育经历

学校名称【待补充】 ｜ 专业【待补充】 ｜ 时间【待补充】

## 实习 / 校园经历

${internships}

${campusExperience}

## 获奖与证书

- 【待补充：奖项或证书】${suggestions}
`
  return `${markdown}${preservedOriginalAppendix(input, markdown)}`
}
