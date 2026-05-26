import type { AnalyzeResumeInput } from '../src/schemas/resume.js'

export const ANALYSIS_PROMPT_VERSION = 'analysis_zh_free_v2'

const jobStageCopy: Record<AnalyzeResumeInput['jobStage'], string> = {
  internship: '实习：突出基础能力、学习速度、项目参与度与可培养性，不要过度要求独立业务结果。',
  campus: '校招：突出课程、竞赛、校园项目、实习与岗位基础能力的匹配。',
  social: '社招：突出真实业务结果、独立交付、跨团队协作、稳定性和可量化影响。',
  graduate: '研究生：突出科研、论文、实验、工程深度、方法论与技术沉淀。',
  career_change: '转行：突出迁移能力、过往经历中与目标岗位相关的技能、项目证据和学习路径。',
  other: '其他：按通用求职场景分析，优先保证真实性、岗位匹配度和可读性。',
}

const languageCopy: Record<AnalyzeResumeInput['outputLanguage'], string> = {
  zh: '中文输出，适合国内岗位投递。',
  en: '英文输出，适合外企、海外项目或英文 JD。分析结论和建议也请使用英文。',
}

const levelCopy: Record<AnalyzeResumeInput['optimizeLevel'], string> = {
  conservative: '保守优化：少改写，尽量保留原表达，只修复明显问题。',
  standard: '标准优化：平衡真实性与岗位匹配度，重组表达但不改变事实。',
  strong: '增强优化：更积极地重组表达、补齐结构、强化关键词和成果呈现，但仍不得编造事实。',
}

export function buildAnalysisPrompt(input: AnalyzeResumeInput) {
  return `请分析以下简历与目标岗位的匹配情况。

目标岗位：${input.targetJob}

岗位 JD：${input.jobDescription || '用户未提供 JD，请按目标岗位通用要求分析，并提醒用户补充 JD。'}

前端优化参数：
- 简历类型：${input.jobStage}，${jobStageCopy[input.jobStage]}
- 输出语言：${input.outputLanguage}，${languageCopy[input.outputLanguage]}
- 优化强度：${input.optimizeLevel}，${levelCopy[input.optimizeLevel]}

用户简历：
${input.resumeText}

请只输出 JSON，结构如下：
{
  "oneSentenceConclusion": string,
  "score": number,
  "matchRate": number,
  "grade": "优秀" | "良好" | "待优化",
  "mainProblems": [
    {
      "problem": string,
      "impact": string,
      "suggestion": string,
      "priority": "high" | "medium" | "low"
    }
  ],
  "valueExtraction": [
    {
      "original": string,
      "deliverable": string,
      "result": string,
      "missingQuantification": string,
      "rewriteDirection": string
    }
  ],
  "missingKeywords": string[],
  "questionsToAsk": string[],
  "actionItems": string[]
}`
}
