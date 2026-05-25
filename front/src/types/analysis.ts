export type AnalysisIssue = {
  level: '高' | '中' | '低' | 'high' | 'medium' | 'low'
  text: string
  sectionId?: string
  suggestion?: string
}

export type AnalysisMetric = {
  title: string
  value: string
  unit?: string
  tone?: 'green'
}

export type AnalysisResult = {
  analysisId?: string
  resumeId?: string
  versionId?: string
  score: number
  matchRate: number
  grade: string
  summary: string
  oneSentenceConclusion?: string
  issues: AnalysisIssue[]
  keywords: string[]
  valueExtraction?: Array<{
    module: string
    currentProblem: string
    direction: string
  }>
  actionItems?: string[]
  questionsToAsk?: string[]
  isPlaceholder?: boolean
}
