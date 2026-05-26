import { z } from 'zod'

export const jobStageSchema = z.enum(['internship', 'campus', 'social', 'graduate', 'career_change', 'other'])
export const outputLanguageSchema = z.enum(['zh', 'en'])
export const optimizeLevelSchema = z.enum(['conservative', 'standard', 'strong'])
export const lapisThemeSchema = z.enum(['lapis-cv', 'lapis-cv-serif'])

export const analyzeResumeSchema = z.object({
  resumeText: z.string().min(200, 'Resume text must be at least 200 characters').max(12000),
  targetJob: z.string().min(2, 'Target job is required').max(100),
  jobDescription: z.string().max(8000).optional().default(''),
  jobStage: jobStageSchema.default('internship'),
  outputLanguage: outputLanguageSchema.default('zh'),
  optimizeLevel: optimizeLevelSchema.default('standard'),
  originalName: z.string().max(255).optional(),
})

export const createResumeSchema = z.object({
  title: z.string().min(1).max(255),
  sourceType: z.enum(['markdown', 'text', 'pdf', 'docx']),
  content: z.string().min(20).max(12000),
  originalName: z.string().max(255).optional(),
})

export const optimizeResumeSchema = z.object({
  targetRole: z.string().min(2).max(100),
  targetJD: z.string().max(8000).optional().default(''),
  jobStage: jobStageSchema.default('internship'),
  outputLanguage: outputLanguageSchema.default('zh'),
  optimizeLevel: optimizeLevelSchema.default('standard'),
})

export const markdownUpdateSchema = z.object({
  markdown: z.string().min(20).max(30000),
  theme: lapisThemeSchema.default('lapis-cv'),
})

export const saveResumeVersionSchema = markdownUpdateSchema.extend({
  changes: z.array(z.unknown()).optional().default([]),
})

export const pdfExportSchema = z.object({
  theme: lapisThemeSchema.default('lapis-cv'),
  pageSize: z.literal('A4').default('A4'),
})

export const exportResumeSchema = z.object({
  versionId: z.string().optional(),
  markdown: z.string().min(20).max(30000).optional(),
  theme: lapisThemeSchema.default('lapis-cv'),
  filename: z.string().max(255).optional(),
})

export type AnalyzeResumeInput = z.infer<typeof analyzeResumeSchema>
export type CreateResumeInput = z.infer<typeof createResumeSchema>
export type OptimizeResumeInput = z.infer<typeof optimizeResumeSchema>
export type SaveResumeVersionInput = z.infer<typeof saveResumeVersionSchema>
export type ExportResumeInput = z.infer<typeof exportResumeSchema>
export type LapisTheme = z.infer<typeof lapisThemeSchema>
