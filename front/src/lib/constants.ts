import type { Page } from '../types/navigation'

export const navItems: Array<{ id: Exclude<Page, 'forbidden' | 'not-found'>; label: string }> = [
  { id: 'home', label: '首页' },
  { id: 'optimizer', label: '免费优化' },
  { id: 'result', label: '分析结果' },
  { id: 'edit', label: '编辑导出' },
  { id: 'support', label: '赞助一下' },
]

export const authNavItems: Array<{ id: Page; label: string }> = [
  { id: 'login', label: '登录' },
  { id: 'register', label: '注册' },
]

export const keywords = [
  'Python',
  'SQL',
  '数据分析',
  'RAG',
  'Pandas',
  'Docker',
  '指标体系',
  '可视化',
  '需求分析',
  '沟通协作',
]

export const features = [
  ['为什么免费？', '核心能力免费开放，赞助完全自愿，不做付费解锁。'],
  ['适合谁？', '实习、校招、转行入门、研究生申请前的简历梳理。'],
  ['输出什么？', '差距分析、关键词建议、优化版表达和导出预览。'],
] as const

export const issues = [
  ['高', '项目经历的业务结果不足'],
  ['中', '技能关键词覆盖不完整'],
  ['中', '个人简介过于泛泛'],
] as const
