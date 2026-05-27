import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, DragEvent, MutableRefObject } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, CloudUpload, Clock3, FileText, LockKeyhole, Sparkles, XCircle, Zap } from 'lucide-react'
import {
  ApiRequestError,
  analyzeResume,
  createResume,
  optimizeResume,
  optimizeResumeStream,
  parseResumeFile,
  segmentResumeText,
} from '../../lib/api'
import { cleanResumeText, extractResumeSections } from '../../lib/resume-parser'
import type { AnalyzeResumeResult, JobStage, OptimizeLevel, OptimizeStreamEvent, OutputLanguage, TodayUsage } from '../../types/api'
import type { Navigate } from '../../types/navigation'
import { FormStep } from '../ui/FormStep'
import { InfoNote } from '../ui/InfoNote'
import { QuotaCard } from '../ui/QuotaCard'

type OptimizerFormProps = {
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

const analysisStages = [
  { at: 0, title: '整理简历材料', detail: '正在压缩简历正文、岗位信息和优化偏好。' },
  { at: 10, title: '校验使用次数', detail: '后端正在校验登录态和今日免费次数。' },
  { at: 20, title: '调用 AI 优化', detail: '正在生成结构化诊断和优化后的简历内容。' },
  { at: 75, title: '保存优化版本', detail: '正在生成 Markdown、保存历史快照和版本记录。' },
] as const

const jobStageOptions: Array<{ value: JobStage; label: string; hint: string }> = [
  { value: 'internship', label: '实习', hint: '突出基础、项目与可培养性' },
  { value: 'campus', label: '校招', hint: '强调课程、竞赛与校园项目' },
  { value: 'social', label: '社招', hint: '突出业务结果与独立交付' },
  { value: 'graduate', label: '研究生', hint: '强调科研、论文与技术深度' },
  { value: 'career_change', label: '转行', hint: '提炼迁移能力和岗位相关经历' },
  { value: 'other', label: '其他', hint: '按通用求职场景优化' },
]

const optimizeLevelOptions: Array<{ value: OptimizeLevel; label: string; hint: string }> = [
  { value: 'conservative', label: '保守', hint: '少改写，尽量保留原表达' },
  { value: 'standard', label: '标准', hint: '平衡真实性与投递匹配度' },
  { value: 'strong', label: '增强', hint: '更积极地重组表达和关键词' },
]

const outputLanguageOptions: Array<{ value: OutputLanguage; label: string; hint: string }> = [
  { value: 'zh', label: '中文', hint: '适合国内岗位投递' },
  { value: 'en', label: '英文', hint: '适合外企、海外项目或英文 JD' },
]

const stageCopy: Record<OptimizeStreamEvent['stage'], { title: string; detail: string }> = {
  accepted: { title: '任务已开始', detail: '后端已接收请求，正在准备优化。' },
  checking_usage: { title: '校验使用次数', detail: '后端正在校验登录态和今日免费次数。' },
  loading_resume: { title: '整理简历材料', detail: '正在读取简历内容并合并目标岗位信息。' },
  calling_ai: { title: '调用 AI 优化', detail: '快速模式正在一次性生成分析和结构化优化结果。' },
  saving_version: { title: '保存优化版本', detail: '正在生成 Markdown、保存版本和历史记录。' },
  done: { title: '优化完成', detail: '结果已生成，正在跳转到分析页。' },
  error: { title: '优化失败', detail: '本次没有完成，请稍后重试。' },
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

function estimateProgress(seconds: number) {
  if (seconds < 10) return Math.min(25, 10 + seconds * 1.5)
  if (seconds < 35) return Math.min(65, 25 + (seconds - 10) * 1.6)
  if (seconds < 75) return Math.min(84, 65 + (seconds - 35) * 0.48)
  if (seconds < 150) return Math.min(96, 84 + (seconds - 75) * 0.16)
  return Math.min(98, 96 + (seconds - 150) * 0.02)
}

function activeStageIndex(seconds: number) {
  return analysisStages.reduce((current, stage, index) => seconds >= stage.at ? index : current, 0)
}

function analysisWaitingTip(seconds: number, hasServerStage: boolean) {
  if (hasServerStage) return '正在进行简历分析优化，完成后会自动跳转到结果页。'
  if (seconds >= 150) return '这次等待已经偏长，可以先取消后精简 JD 或简历正文再试；取消不会保存未完成结果。'
  if (seconds >= 90) return '模型可能正在排队或生成长文本。你可以继续等待，也可以取消后稍后重试。'
  if (seconds >= 45) return '正在处理较长内容。前端会低频刷新进度，避免等待时持续重型渲染。'
  return '正在等待后端实时进度，完整分析通常需要 30-90 秒。'
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function OptimizerForm({
  canSubmit,
  go,
  isAuthenticated,
  jobDescription,
  jobStage,
  optimizeLevel,
  originalName,
  outputLanguage,
  resumeText,
  resumeTooShort,
  setJobDescription,
  setJobStage,
  setOptimizeLevel,
  setOriginalName,
  setOutputLanguage,
  setResumeText,
  setSourceResumeId,
  setTargetJob,
  setAnalyzeResult,
  setUsage,
  analysisAbortRef,
  analysisFeedback,
  analysisStartedAt,
  cancelAnalysis,
  isAnalyzing,
  resetAnalysisTask,
  serverStage,
  setAnalysisFeedback,
  setAnalysisStartedAt,
  setIsAnalyzing,
  setServerStage,
  sourceResumeId,
  targetJob,
  usage,
}: OptimizerFormProps) {
  const [isParsing, setIsParsing] = useState(false)
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const currentStageIndex = activeStageIndex(elapsedSeconds)
  const fallbackStage = analysisStages[currentStageIndex]
  const serverCopy = serverStage ? stageCopy[serverStage.stage] : null
  const currentStage = serverCopy
    ? { title: serverCopy.title, detail: serverStage?.message ?? serverCopy.detail }
    : fallbackStage
  const progress = useMemo(
    () => Math.max(serverStage?.progress ?? 0, estimateProgress(elapsedSeconds)),
    [elapsedSeconds, serverStage?.progress],
  )
  const waitingTip = useMemo(
    () => analysisWaitingTip(elapsedSeconds, Boolean(serverStage)),
    [elapsedSeconds, serverStage],
  )
  const hasResumeContent = Boolean(resumeText.trim())
  const hasUploadedFile = Boolean(originalName || hasResumeContent)
  const resumeSections = useMemo(() => extractResumeSections(resumeText), [resumeText])

  useEffect(() => {
    if (!isAnalyzing || analysisStartedAt === null) return undefined

    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - analysisStartedAt) / 1000))
    }
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)

    return () => window.clearInterval(timer)
  }, [analysisStartedAt, isAnalyzing])

  async function handleResumeFile(file: File) {
    if (!isAuthenticated) {
      setAnalysisFeedback('请先登录后再解析简历文件。')
      go('login')
      return
    }

    setAnalysisFeedback(null)
    setIsParsing(true)

    try {
      const parsedPromise = parseResumeFile(file).catch((error: unknown) => {
        if (!isPdfFile(file)) throw error
        return null
      })
      const layoutTextPromise = isPdfFile(file)
        ? import('../../lib/pdf-layout-parser')
          .then(({ extractPdfTextByLayout }) => extractPdfTextByLayout(file))
          .catch(() => '')
        : Promise.resolve('')
      const [parsed, layoutText] = await Promise.all([parsedPromise, layoutTextPromise])
      if (!parsed && layoutText.length < 120) {
        throw new ApiRequestError({ code: 'PARSE_FAILED', message: '文件解析失败，请改用文本粘贴。' })
      }
      const cleanedText = layoutText.length >= 120 ? layoutText : cleanResumeText(parsed?.text ?? '')
      const parsedName = parsed?.originalName ?? file.name
      let nextText = cleanedText
      let nextSourceResumeId = parsed?.resumeId
      let feedback = layoutText.length >= 120
        ? `已按 PDF 版面解析 ${parsedName}，正在调用 AI 分块整理。`
        : `已解析并清洗 ${parsedName}，正在调用 AI 分块整理。`

      if (cleanedText.length >= 80) {
        setAnalysisFeedback(feedback)
        setIsSegmenting(true)
        try {
          const segmented = await segmentResumeText({
            resumeText: cleanedText,
            originalName: parsedName,
          })
          nextText = segmented.text
          nextSourceResumeId = undefined
          feedback = `文件已解析，AI 已整理出 ${segmented.sections.length} 个模块。`
        } catch (segmentError) {
          feedback = segmentError instanceof ApiRequestError
            ? `${feedback.replace('，正在调用 AI 分块整理。', '')}，但 AI 分块失败：${segmentError.message}`
            : `${feedback.replace('，正在调用 AI 分块整理。', '')}，但 AI 分块失败，请稍后手动点击 AI 分块整理。`
        } finally {
          setIsSegmenting(false)
        }
      }

      setResumeText(nextText)
      setOriginalName(parsedName)
      setSourceResumeId(nextSourceResumeId)
      setAnalysisFeedback(feedback)
    } catch (requestError) {
      setAnalysisFeedback(requestError instanceof ApiRequestError ? requestError.message : '文件解析失败，请改用文本粘贴。')
    } finally {
      setIsParsing(false)
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      await handleResumeFile(file)
    } finally {
      event.target.value = ''
    }
  }

  function handleUploadDrag(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setIsDraggingFile(true)
      event.dataTransfer.dropEffect = 'copy'
    }
    if (event.type === 'dragleave') {
      setIsDraggingFile(false)
    }
  }

  async function handleUploadDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingFile(false)

    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await handleResumeFile(file)
  }

  function handleCancelAnalyze() {
    cancelAnalysis()
  }

  async function handleAiSegment() {
    if (!isAuthenticated) {
      setAnalysisFeedback('请先登录后再使用 AI 分块整理。')
      go('login')
      return
    }

    const cleaned = cleanResumeText(resumeText)
    if (cleaned.length < 80) {
      setAnalysisFeedback('简历内容太短，暂时无法进行 AI 分块整理。')
      return
    }

    setAnalysisFeedback(null)
    setIsSegmenting(true)

    try {
      const result = await segmentResumeText({
        resumeText: cleaned,
        originalName,
      })
      setResumeText(result.text)
      setSourceResumeId(undefined)
      setAnalysisFeedback(`AI 已整理出 ${result.sections.length} 个模块，可继续检查正文后开始分析。`)
    } catch (requestError) {
      setAnalysisFeedback(requestError instanceof ApiRequestError ? requestError.message : 'AI 分块整理失败，请稍后重试。')
    } finally {
      setIsSegmenting(false)
    }
  }

  async function handleAnalyze() {
    if (!isAuthenticated) {
      setAnalysisFeedback('请先登录或注册，后端会按你的账号计算今日免费次数。')
      go('login')
      return
    }

    if (usage?.remaining === 0) {
      setAnalysisFeedback('今天的免费优化次数已经用完，明天可以继续使用。')
      return
    }

    if (!canSubmit || isAnalyzing) return

    const cleanedResumeText = cleanResumeText(resumeText)
    if (cleanedResumeText !== resumeText) {
      setResumeText(cleanedResumeText)
    }

    const controller = new AbortController()
    analysisAbortRef.current = controller
    setAnalysisFeedback(null)
    setServerStage(null)
    setIsAnalyzing(true)
    setAnalysisStartedAt(Date.now())
    setElapsedSeconds(0)

    try {
      let result: AnalyzeResumeResult

      try {
        const resumeId = sourceResumeId ?? (await createResume({
          title: originalName ?? `${targetJob}简历`,
          sourceType: 'text',
          content: cleanedResumeText,
          originalName,
        }, { signal: controller.signal })).resumeId

        setSourceResumeId(resumeId)
        const payload = {
          targetRole: targetJob,
          targetJD: jobDescription,
          jobStage,
          outputLanguage,
          optimizeLevel,
        }

        try {
          result = await optimizeResumeStream(resumeId, payload, setServerStage, { signal: controller.signal })
        } catch (requestError) {
          if (requestError instanceof ApiRequestError && requestError.status === 404) {
            result = await optimizeResume(resumeId, payload, { signal: controller.signal })
          } else {
            throw requestError
          }
        }
      } catch (requestError) {
        if (requestError instanceof ApiRequestError && (requestError.code === 'NOT_FOUND' || requestError.status === 404)) {
          result = await analyzeResume({
            resumeText: cleanedResumeText,
            targetJob,
            jobDescription,
            jobStage,
            outputLanguage,
            optimizeLevel,
            originalName,
          }, { signal: controller.signal })
        } else {
          throw requestError
        }
      }

      setAnalyzeResult(result)
      setUsage(result.usage)
      go('result')
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code === 'UNAUTHENTICATED') {
        go('login')
      }
      if (requestError instanceof ApiRequestError && requestError.code === 'REQUEST_CANCELLED') {
        setAnalysisFeedback('已取消本次 AI 分析，未完成结果不会保存。')
      } else {
        setAnalysisFeedback(requestError instanceof ApiRequestError ? requestError.message : 'AI 分析失败，请稍后重试。')
      }
    } finally {
      if (analysisAbortRef.current === controller) {
        analysisAbortRef.current = null
      }
      resetAnalysisTask()
    }
  }

  return (
    <section className="page optimizer-layout">
      <div className="page-heading optimizer-heading">
        <button className="icon-button" onClick={() => go('home')} type="button" aria-label="返回首页">
          <ArrowLeft size={18} />
        </button>
        <div>
          <span className="eyebrow">免费优化流程</span>
          <h2>上传简历并填写目标岗位</h2>
        </div>
      </div>

      {!isAuthenticated && (
        <motion.article className="auth-gate" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <LockKeyhole size={20} />
          <div>
            <strong>登录后使用免费优化次数</strong>
            <p>按北京时间每天重置免费次数。</p>
          </div>
          <button className="button button--primary button--small" onClick={() => go('login')} type="button">
            去登录
          </button>
        </motion.article>
      )}

      <form className="form-card" onSubmit={(event) => event.preventDefault()}>
        <FormStep index={1} title="上传或粘贴简历">
          <label
            className={`upload-zone ${hasUploadedFile ? 'upload-zone--ready' : ''} ${isDraggingFile ? 'upload-zone--dragging' : ''}`}
            onDragEnter={handleUploadDrag}
            onDragLeave={handleUploadDrag}
            onDragOver={handleUploadDrag}
            onDrop={handleUploadDrop}
          >
            {hasUploadedFile ? <FileText size={34} /> : <CloudUpload size={36} />}
            <strong>{isParsing ? '正在解析简历...' : hasUploadedFile ? originalName ?? '已填写简历正文' : '点击或拖动简历到此处上传简历文件'}</strong>
            <span>
              {isDraggingFile
                ? '松开鼠标即可上传并解析文件'
                : hasUploadedFile
                ? `已读取 ${resumeText.length} 字，可点击这里重新上传`
                : '支持 PDF / Word / Markdown / TXT，文件不超过 10MB'}
            </span>
            {hasUploadedFile && (
              <em>
                <CheckCircle2 size={16} />
                文件已解析，下面的正文可继续修改
              </em>
            )}
            <input type="file" accept=".pdf,.doc,.docx,.txt,.md,.markdown" onChange={handleFileChange} />
          </label>
          <label className="field">
            <span>或粘贴简历内容</span>
            <textarea
              value={resumeText}
              onChange={(event) => {
                setResumeText(event.target.value)
                setSourceResumeId(undefined)
              }}
              onBlur={() => setResumeText(cleanResumeText(resumeText))}
              placeholder="将简历内容粘贴在这里，至少 200 字。"
            />
            <small className={resumeTooShort ? 'field-error' : ''}>
              {resumeText.length} / 12000 {resumeTooShort ? '，简历正文至少需要 200 字' : ''}
            </small>
          </label>
          {resumeSections.length > 0 && (
            <div className="resume-section-preview" aria-label="已识别的简历模块">
              <div>
                <Sparkles size={16} />
                <strong>已识别 {resumeSections.length} 个模块</strong>
              </div>
              <ul>
                {resumeSections.map((section) => (
                  <li key={section.title}>
                    <span>{section.title}</span>
                    <small>{section.content.length} 字</small>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={isSegmenting || isAnalyzing || isParsing}
                onClick={handleAiSegment}
              >
                {isSegmenting ? 'AI 分块中...' : 'AI 分块整理'}
              </button>
            </div>
          )}
        </FormStep>

        <FormStep index={2} title="填写目标岗位">
          <label className="field">
            <span>
              目标岗位 <b>*</b>
            </span>
            <input
              value={targetJob}
              onChange={(event) => setTargetJob(event.target.value)}
              placeholder="例如：产品经理、数据分析师、前端工程师"
            />
          </label>
          <label className="field">
            <span>岗位 JD（可选）</span>
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="将 JD 粘贴在这里，不填也可以。"
            />
          </label>
        </FormStep>

        <FormStep index={3} title="选择优化方式">
          <div className="option-group">
            <span className="option-group__label">简历类型</span>
            <div className="choice-grid choice-grid--dense">
              {jobStageOptions.map((option) => (
                <button
                  type="button"
                  className={jobStage === option.value ? 'choice-card is-selected' : 'choice-card'}
                  onClick={() => setJobStage(option.value)}
                  key={option.value}
                >
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="option-group">
            <span className="option-group__label">优化强度</span>
            <div className="choice-grid">
              {optimizeLevelOptions.map((option) => (
                <button
                  type="button"
                  className={optimizeLevel === option.value ? 'choice-card is-selected' : 'choice-card'}
                  onClick={() => setOptimizeLevel(option.value)}
                  key={option.value}
                >
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="option-group">
            <span className="option-group__label">简历语言</span>
            <div className="choice-grid choice-grid--language">
              {outputLanguageOptions.map((option) => (
                <button
                  type="button"
                  className={outputLanguage === option.value ? 'choice-card is-selected' : 'choice-card'}
                  onClick={() => setOutputLanguage(option.value)}
                  key={option.value}
                >
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </FormStep>

        {analysisFeedback && (
          <motion.p className="form-feedback" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {analysisFeedback}
          </motion.p>
        )}

        {isAnalyzing && (
          <motion.article className="analysis-progress-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} role="status" aria-live="polite">
            <div className="analysis-progress-head">
              <span className="analysis-live-dot" aria-hidden="true" />
              <div>
                <strong>{currentStage.title}</strong>
                <p>{currentStage.detail}</p>
              </div>
              <span className="analysis-timer">
                <Clock3 size={15} />
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
            <div className="analysis-progress-track" aria-label={`分析进度 ${Math.round(progress)}%`}>
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="analysis-stage-list">
              {analysisStages.map((stage, index) => {
                const done = index < currentStageIndex
                const active = index === currentStageIndex
                return (
                  <span className={active ? 'is-active' : done ? 'is-done' : ''} key={stage.title}>
                    {done ? <CheckCircle2 size={15} /> : active ? <Sparkles size={15} /> : <i />}
                    {stage.title}
                  </span>
                )
              })}
            </div>
            <div className="analysis-progress-footer">
              <p className="analysis-progress-note">{waitingTip}</p>
              <button className="button button--ghost button--small analysis-cancel-button" onClick={handleCancelAnalyze} type="button">
                <XCircle size={16} />
                取消分析
              </button>
            </div>
          </motion.article>
        )}

        <button
          className="button button--primary submit-button"
          disabled={!canSubmit || isAnalyzing || usage?.remaining === 0}
          onClick={handleAnalyze}
          type="button"
        >
          <Zap size={18} fill="currentColor" /> {isAnalyzing ? `分析中 ${formatElapsed(elapsedSeconds)}` : '开始免费 AI 分析'}
        </button>
      </form>

      <aside className="sticky-aside">
        <QuotaCard isAuthenticated={isAuthenticated} usage={usage} />
        <InfoNote />
      </aside>
    </section>
  )
}
