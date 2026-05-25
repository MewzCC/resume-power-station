import type { AnalyzeResumeInput } from '../src/schemas/resume.js'

export const FAST_OPTIMIZE_PROMPT_VERSION = 'fast_optimize_zh_structured_v2'

function todayInShanghai() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function buildFastOptimizePrompt(input: AnalyzeResumeInput) {
  return `今天日期：${todayInShanghai()}（按 Asia/Shanghai 判断时间；如果原文只写到月份，例如 2026.05，在 2026-05 期间不应判定为未来时间）

目标岗位：
${input.targetJob}

岗位 JD：
${input.jobDescription || '用户未提供 JD，请按目标岗位通用要求优化，并提醒用户补充 JD。'}

求职阶段：
${input.jobStage}

输出语言：
${input.outputLanguage}

优化强度：
${input.optimizeLevel}

原始简历：
${input.resumeText}

请一次性完成简历诊断和结构化优化。

安全要求：
- 只能优化用户已有经历的表达，不得编造公司、学校、项目、证书、时间和具体数字。
- 原始简历里出现过的教育、实习、项目、校园经历、奖项、技能、联系方式必须保留，不允许整段删除；无法判断归属时放入最接近的模块，并用【待补充】提醒用户核对。
- 不要把“当前月份或已过去月份”误判为未来时间；只有明确晚于今天日期的时间才提示核对。
- 缺失信息必须使用【待补充】。
- 不输出 Markdown，不输出解释，不输出代码块。
- JSON 字段必须完整，数组没有内容时返回 []。
- mainProblems 最多 4 条，valueExtraction 最少 2 条最多 5 条。
- projects / internships / campusExperience 必须覆盖原文里的所有对应经历，最多各 6 个；每个经历 bullet 最多 4 条，文字要短。
- valueExtraction 必须输出可展示内容，不允许空数组；每条围绕“原始描述 -> 可交付成果 -> 真实结果/待补充指标 -> 改写方向”。

只输出合法 JSON，结构如下：
{
  "analysis": {
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
  },
  "optimizedResume": {
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
    "internships": [
      {
        "title": string,
        "context": string,
        "original": string,
        "optimizedBullets": string[],
        "reason": string,
        "needsUserInput": string[]
      }
    ],
    "campusExperience": [
      {
        "title": string,
        "context": string,
        "original": string,
        "optimizedBullets": string[],
        "reason": string,
        "needsUserInput": string[]
      }
    ],
    "additionalSuggestions": string[]
  }
}`
}
