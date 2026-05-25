import { useRef, useState } from 'react'
import { validateOptimizerForm } from '../lib/validators'
import { normalizeAnalysisResult, normalizeOptimizedResume } from '../lib/analysis-adapter'
import type { AnalyzeResumeResult, JobStage, OptimizeLevel, OptimizeStreamEvent, OutputLanguage, TodayUsage } from '../types/api'
import type { AnalysisResult } from '../types/analysis'
import type { OptimizedResume } from '../types/resume'

export function useOptimizerStore() {
  const [resumeText, setResumeText] = useState('')
  const [targetJob, setTargetJob] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [jobStage, setJobStage] = useState<JobStage>('internship')
  const [optimizeLevel, setOptimizeLevel] = useState<OptimizeLevel>('standard')
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('zh')
  const [originalName, setOriginalName] = useState<string | undefined>()
  const [sourceResumeId, setSourceResumeId] = useState<string | undefined>()
  const [usage, setUsage] = useState<TodayUsage | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [optimizedResume, setOptimizedResume] = useState<OptimizedResume | null>(null)
  const [lastAnalyzePayload, setLastAnalyzePayload] = useState<AnalyzeResumeResult | null>(null)
  const [analysisFeedback, setAnalysisFeedback] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null)
  const [serverStage, setServerStage] = useState<OptimizeStreamEvent | null>(null)
  const analysisAbortRef = useRef<AbortController | null>(null)

  function setAnalyzeResult(result: AnalyzeResumeResult) {
    setLastAnalyzePayload(result)
    setAnalysisResult(normalizeAnalysisResult(result))
    setOptimizedResume(normalizeOptimizedResume(result))
  }

  function cancelAnalysis() {
    analysisAbortRef.current?.abort()
    setAnalysisFeedback('已取消本次 AI 分析，未完成结果不会保存，也不会自动跳转。')
  }

  function resetAnalysisTask() {
    analysisAbortRef.current = null
    setIsAnalyzing(false)
    setAnalysisStartedAt(null)
    setServerStage(null)
  }

  return {
    resumeText,
    setResumeText,
    targetJob,
    setTargetJob,
    jobDescription,
    setJobDescription,
    jobStage,
    setJobStage,
    optimizeLevel,
    setOptimizeLevel,
    outputLanguage,
    setOutputLanguage,
    originalName,
    setOriginalName,
    sourceResumeId,
    setSourceResumeId,
    usage,
    setUsage,
    analysisResult,
    optimizedResume,
    lastAnalyzePayload,
    setAnalyzeResult,
    analysisFeedback,
    setAnalysisFeedback,
    isAnalyzing,
    setIsAnalyzing,
    analysisStartedAt,
    setAnalysisStartedAt,
    serverStage,
    setServerStage,
    analysisAbortRef,
    cancelAnalysis,
    resetAnalysisTask,
    ...validateOptimizerForm(resumeText, targetJob),
  }
}
