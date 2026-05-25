import type { AnalyzeResumeInput } from '../src/schemas/resume.js'

export const ANALYSIS_PROMPT_VERSION = 'analysis_zh_free_v1'

export function buildAnalysisPrompt(input: AnalyzeResumeInput) {
  return `请分析以下简历与目标岗位的匹配情况。

目标岗位：
${input.targetJob}

岗位 JD：
${input.jobDescription || '用户未提供 JD，请按通用岗位表达质量进行审计，并提醒用户补充 JD。'}

求职阶段：
${input.jobStage}

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
