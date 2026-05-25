import type { AnalysisResult } from '../types/analysis'
import type { OptimizedResume, ResumeChange, ResumeDiffData, ResumeEditorSection, ResumePreviewData } from '../types/resume'

export const placeholderAnalysis: AnalysisResult = {
  isPlaceholder: true,
  score: 86,
  matchRate: 78,
  grade: '优秀',
  summary: '这是一份演示结果。真实联调时，后端需要返回结构化分析、优化后 Markdown 和每一处修改明细。',
  issues: [
    { level: 'high', text: '项目成果缺少量化结果', sectionId: 'work', suggestion: '为关键项目补充转化率、效率、用户规模等指标。' },
    { level: 'medium', text: '个人简介不够贴合目标岗位', sectionId: 'profile', suggestion: '把泛泛描述改成目标岗位能力摘要。' },
    { level: 'medium', text: '技能关键词覆盖不完整', sectionId: 'skills', suggestion: '补齐 JD 高频工具、方法论和业务关键词。' },
  ],
  keywords: ['产品设计', '用户研究', '数据分析', 'SQL', 'Axure', 'Figma', 'Jira', '业务增长'],
  valueExtraction: [
    { module: '工作经历', currentProblem: '职责描述偏笼统', direction: '补充业务目标、协作对象和可验证结果。' },
    { module: '技能', currentProblem: '技能列表未按岗位分组', direction: '按产品工具、数据分析、协作方法拆分。' },
  ],
  actionItems: [
    '逐条确认 AI 新增内容是否来自真实经历。',
    '补齐“建议补充”的指标，不要让 AI 虚构数字。',
    '保存版本前核对右侧修改详情中的新增、优化、删除项。',
  ],
}

const beforeMarkdown = `# 张一凡

产品经理｜3年经验｜北京

## 个人简介

具备3年产品经理经验，熟悉产品从0到1的流程，有较强的沟通和协调能力，对用户体验有一定理解。

## 工作经历

### 某某科技有限公司｜产品经理

- 负责公司产品的需求收集与分析
- 撰写产品需求文档和原型设计
- 协调研发、设计等团队完成产品开发
- 跟进产品上线后的数据表现，持续优化产品

## 教育背景

某某大学｜本科｜计算机科学与技术

## 技能

Axure、Visio、Excel、SQL、墨刀`

const afterMarkdown = `# 张一凡

产品经理｜3年经验｜北京

## 个人简介

3年产品经理经验，主导过从0到1的产品设计与落地，擅长用户需求挖掘、产品规划与数据驱动优化，具备跨团队协作能力，成功推动多个项目提升用户体验与业务增长。

## 工作经历

### 某某科技有限公司｜产品经理

- 主导产品从0到1的规划与设计，负责需求调研、竞品分析、PRD撰写及原型设计
- 协调研发、设计、测试等跨职能团队，确保项目按时高质量交付
- 通过数据分析持续优化产品体验，推动核心功能用户转化率提升 25%
- 建立数据监控体系，跟踪关键指标，基于数据驱动迭代，产品留存率提升 15%

## 教育背景

某某大学｜本科｜计算机科学与技术（GPA 3.6/4.0）

## 技能

Axure RP、Figma、Jira、SQL、Excel（数据透视表）、墨刀、数据分析`

export const placeholderChanges: ResumeChange[] = [
  {
    id: 'change_001',
    sectionId: 'profile',
    section: '个人简介',
    type: 'optimized',
    title: '优化能力摘要',
    before: '具备3年产品经理经验，熟悉产品从0到1的流程，有较强的沟通和协调能力，对用户体验有一定理解。',
    after: '3年产品经理经验，主导过从0到1的产品设计与落地，擅长用户需求挖掘、产品规划与数据驱动优化，具备跨团队协作能力，成功推动多个项目提升用户体验与业务增长。',
    reason: '把泛泛的经验描述改成目标岗位能力摘要，突出从0到1、数据驱动和业务增长。',
    impact: '提升岗位匹配度和专业表达。',
    order: 1,
  },
  {
    id: 'change_002',
    sectionId: 'work',
    section: '工作经历',
    type: 'added',
    title: '补充量化成果',
    after: '推动核心功能用户转化率提升 25%',
    reason: '用量化结果证明业务价值，让经历从“做过”变成“做成”。',
    impact: '增强可信度和简历筛选通过率。',
    order: 2,
  },
  {
    id: 'change_003',
    sectionId: 'work',
    section: '工作经历',
    type: 'optimized',
    title: '重写职责表达',
    before: '负责公司产品的需求收集与分析',
    after: '主导产品从0到1的规划与设计，负责需求调研、竞品分析、PRD撰写及原型设计',
    reason: '突出主导性、产品方法和可交付物。',
    impact: '让招聘方更快识别产品经理核心能力。',
    order: 3,
  },
  {
    id: 'change_004',
    sectionId: 'skills',
    section: '技能',
    type: 'added',
    title: '补齐工具关键词',
    before: 'Axure、Visio、Excel、SQL、墨刀',
    after: 'Axure RP、Figma、Jira、SQL、Excel（数据透视表）、墨刀、数据分析',
    reason: '补充目标岗位常见产品协作工具和数据分析关键词。',
    impact: '提升 ATS 关键词命中。',
    order: 4,
  },
]

export const placeholderDiff: ResumeDiffData = {
  beforeMarkdown,
  afterMarkdown,
  score: {
    before: 68,
    after: 86,
  },
  stats: {
    total: 4,
    added: 2,
    optimized: 2,
    removed: 0,
  },
  summary: '整体简历质量良好，AI 已从内容表达、结构布局、关键词匹配和量化结果四个维度完成优化。请逐条核对修改明细，确认新增数据是否真实。',
  suggestions: ['补充真实业务指标', '保留原始项目事实', '导出前查看完整预览'],
  changes: placeholderChanges,
  targetRole: '产品经理',
}

export const placeholderEditorSections: ResumeEditorSection[] = [
  {
    id: 'profile',
    label: '个人简介',
    original: placeholderChanges[0].before,
    optimized: placeholderChanges[0].after ?? '',
    reason: placeholderChanges[0].reason,
    order: 10,
  },
  {
    id: 'work',
    label: '工作经历',
    original: '负责公司产品的需求收集与分析；撰写产品需求文档和原型设计；协调研发、设计等团队完成产品开发。',
    optimized: '主导产品从0到1的规划与设计，负责需求调研、竞品分析、PRD撰写及原型设计；协调研发、设计、测试等跨职能团队，确保项目按时高质量交付。',
    reason: '把职责描述改成“动作 + 方法 + 产出”的结构。',
    order: 20,
  },
  {
    id: 'skills',
    label: '技能',
    original: placeholderChanges[3].before,
    optimized: placeholderChanges[3].after ?? '',
    items: ['Axure RP / Figma / Jira', 'SQL / Excel 数据透视表', '用户研究 / 竞品分析'],
    reason: placeholderChanges[3].reason,
    order: 30,
  },
]

export const placeholderPreview: ResumePreviewData = {
  isPlaceholder: true,
  name: '张一凡',
  title: '产品经理｜3年经验',
  theme: 'lapis-cv',
  lines: ['Axure RP / Figma / Jira', 'SQL / Excel 数据透视表', '用户研究 / 竞品分析'],
}

export const placeholderOptimizedResume: OptimizedResume = {
  isPlaceholder: true,
  profile: placeholderEditorSections[0]?.optimized,
  skills: placeholderEditorSections[2]?.optimized,
  projects: [{ title: '工作经历', content: placeholderEditorSections[1]?.optimized ?? '' }],
  editorSections: placeholderEditorSections,
  preview: placeholderPreview,
  markdown: afterMarkdown,
  diff: placeholderDiff,
  beforeMarkdown,
  afterMarkdown,
  score: placeholderDiff.score,
  stats: placeholderDiff.stats,
  summary: placeholderDiff.summary,
  suggestions: placeholderDiff.suggestions,
  changes: placeholderChanges,
  targetRole: placeholderDiff.targetRole,
}
