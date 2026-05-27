import type { SegmentResumeInput } from '../src/schemas/resume.js'

export const SEGMENT_PROMPT_VERSION = 'segment_zh_structured_v1'

export function buildSegmentPrompt(input: SegmentResumeInput) {
  return `请把下面这份由 PDF/Word 解析出的简历纯文本整理成标准简历模块。

原文件名：${input.originalName || '未提供'}

原始文本：
${input.resumeText}

要求：
- 只做分块、补标题、整理顺序和轻微格式清洗，不要优化措辞，不要新增经历，不要删除原始信息。
- 如果一段内容无法判断归属，放到 "other" 类型并保留原文。
- 联系方式、求职意向、教育经历、专业技能、实习经历、项目经历、校园经历、获奖证书、自我评价等常见模块要尽量识别。
- 保留原始姓名、电话、邮箱、学校、公司、项目名、时间、链接、奖项等信息。
- content 内可以保留换行和 bullet，但不要使用 Markdown 标题。
- 只输出合法 JSON，不输出解释，不输出代码块。

section.type 只能使用：
basic, intention, education, skills, work, internship, project, campus, awards, research, summary, other

输出结构：
{
  "sections": [
    {
      "title": string,
      "type": "basic" | "intention" | "education" | "skills" | "work" | "internship" | "project" | "campus" | "awards" | "research" | "summary" | "other",
      "content": string,
      "confidence": number
    }
  ],
  "warnings": string[]
}`
}
