import { z } from 'zod'
import { gradeFromScore } from '../lib/grade.js'

const analysisBaseSchema = z.object({
  oneSentenceConclusion: z.string(),
  score: z.number().int().min(0).max(100),
  matchRate: z.number().int().min(0).max(100),
  grade: z.string().optional(),
  mainProblems: z.array(
    z.object({
      problem: z.string(),
      impact: z.string(),
      suggestion: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ),
  valueExtraction: z.array(
    z.object({
      original: z.string(),
      deliverable: z.string(),
      result: z.string(),
      missingQuantification: z.string(),
      rewriteDirection: z.string(),
    }),
  ),
  missingKeywords: z.array(z.string()),
  questionsToAsk: z.array(z.string()),
  actionItems: z.array(z.string()),
})

export const analysisSchema = analysisBaseSchema.transform((analysis) => ({
  ...analysis,
  grade: gradeFromScore(analysis.score),
}))

const optimizedBlockSchema = z.object({
  original: z.string().default(''),
  optimized: z.string(),
  reason: z.string(),
  needsUserInput: z.array(z.string()).default([]),
})

export const optimizedResumeSchema = z.object({
  profile: optimizedBlockSchema,
  skills: z.object({
    optimized: z.array(z.string()),
    reason: z.string(),
  }),
  projects: z.array(
    z.object({
      title: z.string(),
      context: z.string(),
      original: z.string(),
      optimizedBullets: z.array(z.string()),
      reason: z.string(),
      needsUserInput: z.array(z.string()).default([]),
    }),
  ),
  internships: z.array(z.unknown()).default([]),
  campusExperience: z.array(z.unknown()).default([]),
  additionalSuggestions: z.array(z.string()).default([]),
})

export const fullAiResultSchema = z.object({
  analysis: analysisSchema,
  optimizedResume: optimizedResumeSchema,
  lapisMarkdown: z.string().min(20),
})

export type AnalysisResult = z.infer<typeof analysisSchema>
export type OptimizedResumeResult = z.infer<typeof optimizedResumeSchema>
export type FullAiResult = z.infer<typeof fullAiResultSchema>
