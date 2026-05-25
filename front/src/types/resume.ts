export type ResumeSection = {
  id?: string
  title: string
  content: string
  reason?: string
}

export type ResumeEditorSection = {
  id: string
  label: string
  original?: string
  optimized: string
  reason?: string
  items?: string[]
  order?: number
}

export type ResumePreviewData = {
  name: string
  title: string
  theme: 'lapis-cv' | 'lapis-cv-serif'
  lines: string[]
  isPlaceholder?: boolean
}

export type ResumeChangeType = 'added' | 'optimized' | 'removed'

export type ResumeChange = {
  id: string
  resumeId?: string
  versionId?: string
  sectionId?: string
  section: string
  type: ResumeChangeType
  title?: string
  before?: string
  after?: string
  reason: string
  impact?: string
  startIndex?: number
  endIndex?: number
  order?: number
}

export type ResumeOptimizeStats = {
  total: number
  added: number
  optimized: number
  removed: number
}

export type ResumeOptimizeScore = {
  before: number
  after: number
}

export type ResumeDiffData = {
  resumeId?: string
  versionId?: string
  targetRole?: string
  beforeMarkdown: string
  afterMarkdown: string
  score: ResumeOptimizeScore
  stats: ResumeOptimizeStats
  summary: string
  suggestions: string[]
  changes: ResumeChange[]
}

export type OptimizedResume = {
  profile?: string
  education?: string
  skills?: string
  projects?: ResumeSection[]
  internships?: ResumeSection[]
  campusExperience?: ResumeSection[]
  awards?: string
  editorSections?: ResumeEditorSection[]
  preview?: ResumePreviewData
  markdown?: string
  diff?: ResumeDiffData
  beforeMarkdown?: string
  afterMarkdown?: string
  score?: ResumeOptimizeScore
  stats?: ResumeOptimizeStats
  summary?: string
  suggestions?: string[]
  changes?: ResumeChange[]
  targetRole?: string
  isPlaceholder?: boolean
}
