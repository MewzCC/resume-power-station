import type {
  AnalyzeResumePayload,
  AnalyzeResumeResult,
  ApiError,
  ApiResponse,
  AuthSession,
  ArchiveHistoryResult,
  CreateResumePayload,
  CreateResumeResult,
  EmailCodeScene,
  ExportResumePayload,
  ExportResumeResult,
  HistoryQuery,
  OptimizeResumePayload,
  OptimizeStreamEvent,
  ParseResumeResult,
  ResumeHistoryItem,
  ResumeListItem,
  RestoreHistoryPayload,
  RestoreHistoryResult,
  SaveResumeVersionPayload,
  SaveResumeVersionResult,
  SendEmailCodeResult,
  TodayUsage,
  User,
  ResumeVersionHistoryDetail,
  ResumeVersionHistoryListResult,
} from '../types/api'
import type { ResumeDiffData } from '../types/resume'
import { notifyError } from './error-events'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'
const DEFAULT_TIMEOUT_MS = 30000
const FILE_PARSE_TIMEOUT_MS = 60000
const AI_ANALYSIS_TIMEOUT_MS = 300000

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown>
  silentErrors?: boolean
  timeoutMs?: number
}

type AbortableRequest = {
  signal?: AbortSignal
}

export class ApiRequestError extends Error {
  code: ApiError['code']
  details?: ApiError['details']
  status?: number

  constructor(error: ApiError, status?: number) {
    super(error.message)
    this.name = 'ApiRequestError'
    this.code = error.code
    this.details = error.details
    this.status = status
  }
}

const friendlyErrorMessages: Partial<Record<ApiError['code'], string>> = {
  VALIDATION_ERROR: '提交内容不符合要求，请检查表单后再试。',
  EMAIL_ALREADY_EXISTS: '该邮箱已注册，请直接登录。',
  EMAIL_NOT_REGISTERED: '该邮箱尚未注册，请先免费注册。',
  EMAIL_CODE_INVALID: '验证码不正确，请重新输入。',
  EMAIL_CODE_EXPIRED: '验证码已过期，请重新获取。',
  EMAIL_CODE_TOO_FREQUENT: '验证码发送太频繁，请稍后再试。',
  EMAIL_CODE_SEND_FAILED: '验证码邮件发送失败，请稍后重试。',
  INVALID_CREDENTIALS: '邮箱、密码或验证码不正确，请重新输入。',
  PASSWORD_INCORRECT: '密码错误，请重新输入。',
  UNAUTHENTICATED: '请先登录后再使用免费优化次数。',
  DAILY_LIMIT_EXCEEDED: '今天的 3 次免费优化已经用完，明天可以继续使用。',
  FILE_TOO_LARGE: '文件超过大小限制，请上传 10MB 以内的文件。',
  UNSUPPORTED_FILE_TYPE: '文件类型不支持，请上传 TXT、DOCX 或 PDF。',
  PARSE_FAILED: '文件解析失败，请改用文本粘贴。',
  AI_FAILED: 'AI 分析暂时失败，请稍后重试，本次不会扣次数。',
  AI_JSON_INVALID: 'AI 返回格式异常，请稍后重试，本次不会扣次数。',
  NOT_FOUND: '资源不存在，或你没有权限访问。',
  PDF_EXPORT_UNAVAILABLE: 'PDF 导出暂不可用，请先下载 Markdown 后手动导出。',
  REQUEST_TIMEOUT: 'AI 分析已等待 5 分钟仍未完成，请稍后重试，或精简简历和 JD 后再分析。',
  REQUEST_CANCELLED: '已取消本次请求。',
  NETWORK_ERROR: '无法连接服务器，请确认服务端是否正常。',
}

function normalizeError(error: ApiError): ApiError {
  return {
    ...error,
    message: friendlyErrorMessages[error.code] ?? error.message ?? '请求失败，请稍后重试。',
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function createTimeoutController(externalSignal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController()
  let abortReason: 'timeout' | 'cancel' | null = null
  let timeoutId: number | undefined

  const abortFromExternalSignal = () => {
    abortReason = 'cancel'
    controller.abort()
  }

  if (externalSignal?.aborted) {
    abortFromExternalSignal()
  } else {
    externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true })
  }

  if (timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      abortReason = 'timeout'
      controller.abort()
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    getAbortReason: () => abortReason,
    cleanup: () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      externalSignal?.removeEventListener('abort', abortFromExternalSignal)
    },
  }
}

function toAbortApiError(abortReason: 'timeout' | 'cancel' | null) {
  return normalizeError({
    code: abortReason === 'timeout' ? 'REQUEST_TIMEOUT' : 'REQUEST_CANCELLED',
    message: abortReason === 'timeout'
      ? 'AI 分析已等待 5 分钟仍未完成，请稍后重试。'
      : '已取消本次请求。',
  })
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    body: requestBody,
    silentErrors,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    ...fetchOptions
  } = options
  const headers = new Headers(options.headers)
  const isFormData = requestBody instanceof FormData
  let body: BodyInit | undefined

  if (requestBody) {
    body = !isFormData && typeof requestBody !== 'string'
      ? JSON.stringify(requestBody)
      : (requestBody as BodyInit)
  }

  if (body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const timeout = createTimeoutController(externalSignal, timeoutMs)
  let response: Response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      body,
      credentials: 'include',
      headers,
      signal: timeout.signal,
    })
  } catch (requestError) {
    const error = isAbortError(requestError)
      ? toAbortApiError(timeout.getAbortReason())
      : normalizeError({ code: 'NETWORK_ERROR', message: '无法连接服务器，请确认服务端是否正常。' })
    if (!silentErrors && error.code !== 'REQUEST_CANCELLED') {
      notifyError(error.message)
    }
    throw new ApiRequestError(error)
  } finally {
    timeout.cleanup()
  }

  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    const error = normalizeError({
      code: 'NETWORK_ERROR',
      message: '服务器返回格式异常，请稍后重试。',
    })
    if (!silentErrors) {
      notifyError(error.message)
    }
    throw new ApiRequestError(error, response.status)
  }

  if (!response.ok || !payload.success) {
    const error = normalizeError(payload.success
      ? { code: 'NETWORK_ERROR' as const, message: '请求失败，请稍后重试。' }
      : payload.error)
    if (!silentErrors) {
      notifyError(error.message)
    }
    throw new ApiRequestError(error, response.status)
  }

  return payload.data
}

export function registerAccount(input: { email: string; password: string; name?: string }) {
  return request<AuthSession>('/api/auth/register', {
    method: 'POST',
    body: input,
  })
}

export function loginAccount(input: { email: string; password: string }) {
  return request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: input,
  })
}

export function sendEmailCode(input: { email: string; scene: EmailCodeScene }) {
  return request<SendEmailCodeResult>('/api/auth/email-code/send', {
    method: 'POST',
    body: input,
  })
}

export function registerWithEmailCode(input: { email: string; code: string; password: string; name?: string }) {
  return request<AuthSession>('/api/auth/register/email-code', {
    method: 'POST',
    body: input,
  })
}

export function loginWithEmailCode(input: { email: string; code: string }) {
  return request<AuthSession>('/api/auth/login/email-code', {
    method: 'POST',
    body: input,
  })
}

export function resetPassword(input: { email: string; code: string; password: string }) {
  return request<{ reset: boolean }>('/api/auth/password/reset', {
    method: 'POST',
    body: input,
  })
}

export async function getCurrentUser() {
  const data = await request<{ user: User }>('/api/auth/me', { silentErrors: true })
  return data.user
}

export function logoutAccount() {
  return request<{ loggedOut: boolean }>('/api/auth/logout', {
    method: 'POST',
  })
}

export function getTodayUsage() {
  return request<TodayUsage>('/api/usage/today')
}

export function parseResumeFile(file: File, requestOptions: AbortableRequest = {}) {
  const body = new FormData()
  body.append('file', file)

  return request<ParseResumeResult>('/api/resumes/parse', {
    method: 'POST',
    body,
    signal: requestOptions.signal,
    timeoutMs: FILE_PARSE_TIMEOUT_MS,
  })
}

export function analyzeResume(payload: AnalyzeResumePayload, requestOptions: AbortableRequest = {}) {
  return request<AnalyzeResumeResult>('/api/resumes/analyze', {
    method: 'POST',
    body: payload,
    signal: requestOptions.signal,
    timeoutMs: AI_ANALYSIS_TIMEOUT_MS,
  })
}

export function createResume(payload: CreateResumePayload, requestOptions: AbortableRequest = {}) {
  return request<CreateResumeResult>('/api/resumes', {
    method: 'POST',
    body: payload,
    signal: requestOptions.signal,
  })
}

export function optimizeResume(
  resumeId: string,
  payload: OptimizeResumePayload,
  requestOptions: AbortableRequest = {},
) {
  return request<AnalyzeResumeResult>(`/api/resumes/${resumeId}/optimize`, {
    method: 'POST',
    body: payload,
    signal: requestOptions.signal,
    timeoutMs: AI_ANALYSIS_TIMEOUT_MS,
  })
}

function parseSseFrame(frame: string): OptimizeStreamEvent | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n')

  if (!data) return null
  return JSON.parse(data) as OptimizeStreamEvent
}

export async function optimizeResumeStream(
  resumeId: string,
  payload: OptimizeResumePayload,
  onEvent: (event: OptimizeStreamEvent) => void,
  requestOptions: AbortableRequest = {},
) {
  const timeout = createTimeoutController(requestOptions.signal, AI_ANALYSIS_TIMEOUT_MS)
  let response: Response

  try {
    response = await fetch(`${API_BASE}/api/resumes/${resumeId}/optimize/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: timeout.signal,
    })
  } catch (requestError) {
    const error = isAbortError(requestError)
      ? toAbortApiError(timeout.getAbortReason())
      : normalizeError({ code: 'NETWORK_ERROR', message: '无法连接服务器，请确认服务端是否正常。' })
    if (error.code !== 'REQUEST_CANCELLED') {
      notifyError(error.message)
    }
    timeout.cleanup()
    throw new ApiRequestError(error)
  }

  if (!response.ok) {
    timeout.cleanup()
    const payload = (await response.json()) as ApiResponse<unknown>
    const error = normalizeError(payload.success
      ? { code: 'NETWORK_ERROR' as const, message: '请求失败，请稍后重试。' }
      : payload.error)
    notifyError(error.message)
    throw new ApiRequestError(error, response.status)
  }

  if (!response.body) {
    timeout.cleanup()
    const error = normalizeError({
      code: 'NETWORK_ERROR',
      message: '服务器未返回流式响应。',
    })
    notifyError(error.message)
    throw new ApiRequestError(error)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: AnalyzeResumeResult | undefined

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split(/\r?\n\r?\n/)
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const event = parseSseFrame(frame)
        if (!event) continue

        onEvent(event)

        if (event.stage === 'error' && event.error) {
          const error = normalizeError(event.error)
          notifyError(error.message)
          throw new ApiRequestError(error)
        }

        if (event.stage === 'done' && event.result) {
          result = event.result
        }
      }
    }
  } catch (requestError) {
    if (!isAbortError(requestError)) {
      throw requestError
    }

    const error = toAbortApiError(timeout.getAbortReason())
    if (error.code !== 'REQUEST_CANCELLED') {
      notifyError(error.message)
    }
    throw new ApiRequestError(error)
  } finally {
    timeout.cleanup()
  }

  if (!result) {
    const error = normalizeError({
      code: 'NETWORK_ERROR',
      message: '优化任务未返回结果，请稍后重试。',
    })
    notifyError(error.message)
    throw new ApiRequestError(error)
  }

  return result
}

export function getResumeDiff(resumeId: string, versionId: string) {
  return request<ResumeDiffData>(`/api/resumes/${resumeId}/versions/${versionId}/diff`)
}

export function saveResumeVersion(versionId: string, payload: SaveResumeVersionPayload) {
  return request<SaveResumeVersionResult>(`/api/resumes/versions/${versionId}`, {
    method: 'PUT',
    body: payload,
  })
}

export function exportResumePdf(resumeId: string, payload: ExportResumePayload) {
  return request<ExportResumeResult>(`/api/resumes/${resumeId}/export/pdf`, {
    method: 'POST',
    body: payload,
  })
}

export function exportResumeDocx(resumeId: string, payload: ExportResumePayload) {
  return request<ExportResumeResult>(`/api/resumes/${resumeId}/export/docx`, {
    method: 'POST',
    body: payload,
  })
}

export function listResumes() {
  return request<{ items: ResumeListItem[] }>('/api/resumes')
}

export function listResumeHistory() {
  return request<{ items: ResumeHistoryItem[] }>('/api/resumes/history')
}

function toQueryString(query: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return
    params.set(key, String(value))
  })
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function listResumeVersionHistory(query: HistoryQuery = {}, requestOptions: Pick<RequestOptions, 'silentErrors'> = {}) {
  return request<ResumeVersionHistoryListResult>(
    `/api/history/resume-versions${toQueryString({
      cursor: query.cursor,
      limit: query.limit,
      q: query.q,
      targetRole: query.targetRole,
      from: query.from,
      to: query.to,
      includeArchived: query.includeArchived,
    })}`,
    requestOptions,
  )
}

export function getResumeVersionHistory(historyId: string) {
  return request<ResumeVersionHistoryDetail>(`/api/history/resume-versions/${historyId}`)
}

export function restoreResumeVersionHistory(historyId: string, payload: RestoreHistoryPayload = {}) {
  return request<RestoreHistoryResult>(`/api/history/resume-versions/${historyId}/restore`, {
    method: 'POST',
    body: payload,
  })
}

export function archiveResumeVersionHistory(historyId: string) {
  return request<ArchiveHistoryResult>(`/api/history/resume-versions/${historyId}`, {
    method: 'DELETE',
  })
}

export function unarchiveResumeVersionHistory(historyId: string) {
  return request<ArchiveHistoryResult>(`/api/history/resume-versions/${historyId}/unarchive`, {
    method: 'POST',
  })
}
