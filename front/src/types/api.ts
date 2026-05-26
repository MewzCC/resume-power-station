import type { AnalysisResult } from './analysis'
import type { OptimizedResume, ResumeChange, ResumeDiffData } from './resume'

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_ALREADY_EXISTS'
  | 'EMAIL_NOT_REGISTERED'
  | 'EMAIL_CODE_INVALID'
  | 'EMAIL_CODE_EXPIRED'
  | 'EMAIL_CODE_TOO_FREQUENT'
  | 'EMAIL_CODE_SEND_FAILED'
  | 'INVALID_CREDENTIALS'
  | 'PASSWORD_INCORRECT'
  | 'UNAUTHENTICATED'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'PARSE_FAILED'
  | 'AI_FAILED'
  | 'AI_JSON_INVALID'
  | 'NOT_FOUND'
  | 'PDF_EXPORT_UNAVAILABLE'
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_CANCELLED'
  | 'NETWORK_ERROR'

export type ApiError = {
  code: ApiErrorCode
  message: string
  details?: Record<string, unknown>
}

export type ApiResponse<T> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: ApiError
    }

export type User = {
  id: string
  email: string
  name?: string | null
  role: 'USER' | 'ADMIN' | string
}

export type AuthSession = {
  user: User
  expiresAt?: string
}

export type EmailCodeScene = 'login' | 'register' | 'resetPassword'

export type SendEmailCodeResult = {
  expiresIn: number
  resendAfter: number
  devCode?: string
}

export type TodayUsage = {
  limit: number
  used: number
  remaining: number
  resetAt: string
}

export type ParseResumeResult = {
  resumeId?: string
  text: string
  markdown?: string
  originalName: string
  size: number
}

export type JobStage = 'internship' | 'campus' | 'social' | 'graduate' | 'career_change' | 'other'
export type OutputLanguage = 'zh' | 'en'
export type OptimizeLevel = 'conservative' | 'standard' | 'strong'

export type AnalyzeResumePayload = {
  resumeText: string
  targetJob: string
  jobDescription?: string
  jobStage: JobStage
  outputLanguage: OutputLanguage
  optimizeLevel: OptimizeLevel
  originalName?: string
}

export type AnalyzeResumeResult = {
  resumeId: string
  analysisId: string
  versionId: string
  remaining: number
  usage: TodayUsage
  analysis?: AnalysisResult
  optimizedResume?: OptimizedResume
  lapisMarkdown?: string
  targetRole?: string
  beforeMarkdown?: string
  afterMarkdown?: string
  score?: {
    before: number
    after: number
  }
  stats?: {
    total: number
    added: number
    optimized: number
    removed: number
  }
  summary?: string
  suggestions?: string[]
  changes?: ResumeChange[]
  diff?: ResumeDiffData
}

export type CreateResumePayload = {
  title: string
  sourceType: 'markdown' | 'text' | 'pdf' | 'docx'
  content: string
  originalName?: string
}

export type CreateResumeResult = {
  resumeId: string
}

export type OptimizeResumePayload = {
  targetRole: string
  targetJD?: string
  jobStage: AnalyzeResumePayload['jobStage']
  outputLanguage: AnalyzeResumePayload['outputLanguage']
  optimizeLevel: AnalyzeResumePayload['optimizeLevel']
}

export type OptimizeStreamStage =
  | 'accepted'
  | 'checking_usage'
  | 'loading_resume'
  | 'calling_ai'
  | 'saving_version'
  | 'done'
  | 'error'

export type OptimizeStreamEvent = {
  stage: OptimizeStreamStage
  progress: number
  message?: string
  result?: AnalyzeResumeResult
  error?: ApiError
}

export type SaveResumeVersionPayload = {
  markdown: string
  changes?: ResumeChange[]
  theme?: 'lapis-cv' | 'lapis-cv-serif'
}

export type SaveResumeVersionResult = {
  versionId: string
  savedAt: string
}

export type ExportResumePayload = {
  versionId?: string
  markdown?: string
  theme: 'lapis-cv' | 'lapis-cv-serif'
  filename?: string
}

export type ExportResumeResult = {
  downloadUrl: string
  filename?: string
  expiresAt?: string
}

export type ResumeListItem = {
  id: string
  title: string
  sourceType: 'markdown' | 'text' | 'pdf' | 'docx'
  createdAt: string
  updatedAt: string
  latestVersionId?: string
  latestScore?: number
}

export type ResumeHistoryItem = {
  resumeId: string
  versionId: string
  title: string
  targetRole?: string
  score?: number
  stats?: AnalyzeResumeResult['stats']
  createdAt: string
}

export type HistoryQuery = {
  cursor?: string
  limit?: number
  q?: string
  targetRole?: string
  from?: string
  to?: string
  includeArchived?: boolean
}

export type ResumeVersionHistoryItem = {
  historyId: string
  resumeId: string
  versionId: string
  title: string
  versionName?: string
  targetRole?: string
  sourceType?: CreateResumePayload['sourceType']
  score?: number
  matchRate?: number
  summary?: string
  markdownPreview?: string
  archived: boolean
  canRestore?: boolean
  restoredFromVersionId?: string | null
  createdAt: string
  updatedAt?: string
}

export type HistoryPageInfo = {
  limit: number
  nextCursor?: string | null
  hasMore: boolean
}

export type ResumeVersionHistoryListResult = {
  items: ResumeVersionHistoryItem[]
  pageInfo: HistoryPageInfo
}

export type HistoryEditorPayload = {
  sourceResumeId?: string
  resumeText?: string
  originalName?: string
  targetJob?: string
  jobDescription?: string
  jobStage?: AnalyzeResumePayload['jobStage']
  outputLanguage?: AnalyzeResumePayload['outputLanguage']
  optimizeLevel?: AnalyzeResumePayload['optimizeLevel']
}

export type ResumeVersionHistoryDetail = ResumeVersionHistoryItem & {
  analysisId?: string
  analysis?: Partial<AnalysisResult> & {
    oneSentenceConclusion?: string
    mainProblems?: Array<string | { text?: string; level?: string; suggestion?: string }>
    valueExtraction?: AnalysisResult['valueExtraction']
    missingKeywords?: string[]
    questionsToAsk?: string[]
    actionItems?: string[]
  }
  optimizedResume?: OptimizedResume
  diff?: ResumeDiffData
  lapisMarkdown?: string
  lapisTheme?: 'lapis-cv' | 'lapis-cv-serif'
  editorPayload?: HistoryEditorPayload
  restoreOptions?: {
    defaultMode?: 'newVersion' | 'newResume'
    modes?: Array<'newVersion' | 'newResume'>
    safeRestore?: boolean
  }
}

export type RestoreHistoryPayload = {
  restoreMode?: 'newVersion' | 'newResume'
  versionName?: string
}

export type RestoreHistoryResult = {
  restored: boolean
  restoreMode: 'newVersion' | 'newResume'
  resumeId: string
  versionId: string
  historyId: string
  restoredFromVersionId?: string
  editorPayload?: HistoryEditorPayload
}

export type ArchiveHistoryResult = {
  historyId: string
  archived: boolean
  deletedAt?: string
  updatedAt?: string
}
