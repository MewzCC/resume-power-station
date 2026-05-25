import type { MutableRefObject } from 'react'
import { OptimizerForm } from '../../components/optimizer/OptimizerForm'
import type { AnalyzeResumeResult, JobStage, OptimizeLevel, OptimizeStreamEvent, OutputLanguage, TodayUsage } from '../../types/api'
import type { Navigate } from '../../types/navigation'

type OptimizerPageProps = {
  canSubmit: boolean
  isAuthenticated: boolean
  jobDescription: string
  jobStage: JobStage
  optimizeLevel: OptimizeLevel
  originalName?: string
  outputLanguage: OutputLanguage
  resumeText: string
  resumeTooShort: boolean
  setJobDescription: (value: string) => void
  setJobStage: (value: JobStage) => void
  setOptimizeLevel: (value: OptimizeLevel) => void
  setOriginalName: (value?: string) => void
  setOutputLanguage: (value: OutputLanguage) => void
  setResumeText: (value: string) => void
  setSourceResumeId: (value?: string) => void
  setTargetJob: (value: string) => void
  setAnalyzeResult: (result: AnalyzeResumeResult) => void
  setUsage: (usage: TodayUsage | null) => void
  analysisAbortRef: MutableRefObject<AbortController | null>
  analysisFeedback: string | null
  analysisStartedAt: number | null
  cancelAnalysis: () => void
  isAnalyzing: boolean
  resetAnalysisTask: () => void
  serverStage: OptimizeStreamEvent | null
  setAnalysisFeedback: (value: string | null) => void
  setAnalysisStartedAt: (value: number | null) => void
  setIsAnalyzing: (value: boolean) => void
  setServerStage: (value: OptimizeStreamEvent | null) => void
  sourceResumeId?: string
  targetJob: string
  usage: TodayUsage | null
  go: Navigate
}

export function OptimizerPage(props: OptimizerPageProps) {
  return <OptimizerForm {...props} />
}

export default OptimizerPage
