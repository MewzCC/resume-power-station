import type { AnalysisResult } from '../src/schemas/ai.js'
import type { AnalyzeResumeInput } from '../src/schemas/resume.js'

export const OPTIMIZE_PROMPT_VERSION = 'optimize_zh_lapiscv_free_v1'

export function buildOptimizePrompt(input: AnalyzeResumeInput, analysis: AnalysisResult) {
  return `请基于以下简历、岗位 JD 和分析结果，生成优化后的简历内容，并额外输出 LapisCV 兼容 Markdown。

目标岗位：
${input.targetJob}

岗位 JD：
${input.jobDescription || '用户未提供 JD'}

原始简历：
${input.resumeText}

分析结果：
${JSON.stringify(analysis)}

强制要求：
- 不得编造用户没有提供的信息。
- 缺少事实或数据时必须使用【待补充】占位符。
- 每个项目经历必须先有一句项目描述，再列 bullet。
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
