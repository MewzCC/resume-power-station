import type { AnalysisResult } from '../src/schemas/ai.js'
import type { AnalyzeResumeInput } from '../src/schemas/resume.js'

export const OPTIMIZE_PROMPT_VERSION = 'optimize_zh_lapiscv_free_v2'

const jobStageCopy: Record<AnalyzeResumeInput['jobStage'], string> = {
  internship: '实习：突出基础能力、学习速度、项目参与度与可培养性。',
  campus: '校招：突出课程、竞赛、校园项目、实习与岗位基础能力的匹配。',
  social: '社招：突出真实业务结果、独立交付、复杂问题解决、稳定性和可量化影响。',
  graduate: '研究生：突出科研、论文、实验、工程深度、方法论与技术沉淀。',
  career_change: '转行：突出迁移能力、目标岗位相关经历、学习路径和可验证项目证据。',
  other: '其他：按通用求职场景优化。',
}

const languageCopy: Record<AnalyzeResumeInput['outputLanguage'], string> = {
  zh: '输出中文简历。',
  en: '输出英文简历；专有名词可保留英文，中文学校/公司名可给出英文占位。',
}

const levelCopy: Record<AnalyzeResumeInput['optimizeLevel'], string> = {
  conservative: '保守：少改写，尽量保留原表达。',
  standard: '标准：平衡真实性与岗位匹配度。',
  strong: '增强：更积极地重组表达和关键词，但不得编造事实。',
}

export function buildOptimizePrompt(input: AnalyzeResumeInput, analysis: AnalysisResult) {
  return `请基于以下简历、岗位 JD、前端优化参数和分析结果，生成优化后的简历内容，并额外输出 LapisCV 兼容 Markdown。

目标岗位：${input.targetJob}

岗位 JD：${input.jobDescription || '用户未提供 JD'}

前端优化参数必须生效：
- 简历类型 jobStage=${input.jobStage}：${jobStageCopy[input.jobStage]}
- 输出语言 outputLanguage=${input.outputLanguage}：${languageCopy[input.outputLanguage]}
- 优化强度 optimizeLevel=${input.optimizeLevel}：${levelCopy[input.optimizeLevel]}

原始简历：
${input.resumeText}

分析结果：${JSON.stringify(analysis)}

强制要求：
- 不得编造用户没有提供的信息。
- 缺少事实或数据时必须使用【待补充】占位符。
- 原始简历中的关键经历不得整段删除。
- 每个项目经历必须先有一句项目描述，再列 bullet。
- 如果 outputLanguage=en，lapisMarkdown 和 optimized 字段必须以英文为主。
- 如果 jobStage=social，重点强化业务结果、独立交付、性能、稳定性、效率、质量等表达。
- 如果 jobStage=career_change，重点强化迁移能力和目标岗位相关证据。
- lapisMarkdown 必须是一份完整 Markdown 简历，不要解释文字、不要代码块、不要脚本。
- 不要输出付费、会员、购买次数、付费解锁相关文案。

请只输出 JSON，结构如下：
{
  "profile": {
    "original": string,
    "optimized": string,
    "reason": string,
    "needsUserInput": string[]
  },
  "skills": {
    "optimized": string[],
    "reason": string
  },
  "projects": [
    {
      "title": string,
      "context": string,
      "original": string,
      "optimizedBullets": string[],
      "reason": string,
      "needsUserInput": string[]
    }
  ],
  "internships": [],
  "campusExperience": [],
  "additionalSuggestions": string[],
  "lapisMarkdown": "# 姓名【待补充】\\n\\n> 电话【待补充】 ｜ 邮箱【待补充】\\n\\n## 教育经历\\n..."
}`
}
