import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Eye, FileText, Filter, History, Loader2, RefreshCw, RotateCcw, Search, Undo2 } from 'lucide-react'
import {
  ApiRequestError,
  archiveResumeVersionHistory,
  getResumeVersionHistory,
  listResumeVersionHistory,
  restoreResumeVersionHistory,
  unarchiveResumeVersionHistory,
} from '../../../lib/api'
import { notifyError, notifySuccess } from '../../../lib/error-events'
import type {
  AnalyzeResumePayload,
  AnalyzeResumeResult,
  HistoryEditorPayload,
  ResumeVersionHistoryDetail,
  ResumeVersionHistoryItem,
} from '../../../types/api'
import type { AnalysisIssue, AnalysisResult } from '../../../types/analysis'
import type { Navigate } from '../../../types/navigation'
import type { ResumeDiffData } from '../../../types/resume'

type DashboardHistoryPageProps = {
  go: Navigate
  setAnalyzeResult: (result: AnalyzeResumeResult) => void
  setJobDescription: (value: string) => void
  setJobStage: (value: AnalyzeResumePayload['jobStage']) => void
  setOptimizeLevel: (value: AnalyzeResumePayload['optimizeLevel']) => void
  setOriginalName: (value?: string) => void
  setOutputLanguage: (value: AnalyzeResumePayload['outputLanguage']) => void
  setResumeText: (value: string) => void
  setSourceResumeId: (value?: string) => void
  setTargetJob: (value: string) => void
}

const defaultUsage = {
  limit: 0,
  used: 0,
  remaining: 0,
  resetAt: '',
}

function formatDate(value?: string) {
  if (!value) return '未知时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function scoreGrade(score = 0) {
  if (score > 85) return '优秀'
  if (score > 70) return '良好'
  return '待优化'
}

function normalizeGrade(grade: unknown, score = 0) {
  return grade === '优秀' || grade === '良好' || grade === '待优化'
    ? grade
    : scoreGrade(score)
}

function normalizeIssue(item: unknown, index: number): AnalysisIssue {
  if (typeof item === 'string') {
    return { level: index === 0 ? 'high' : 'medium', text: item }
  }

  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>
    const rawLevel = String(record.level ?? 'medium')
    const level: AnalysisIssue['level'] = rawLevel === 'high' || rawLevel === 'low' ? rawLevel : 'medium'
    return {
      level,
      text: String(record.text ?? record.title ?? record.problem ?? '待确认问题'),
      suggestion: typeof record.suggestion === 'string' ? record.suggestion : undefined,
    }
  }

  return { level: 'medium', text: '待确认问题' }
}

function fallbackDiff(detail: ResumeVersionHistoryDetail): ResumeDiffData {
  const score = detail.score ?? detail.analysis?.score ?? 0
  const markdown = detail.lapisMarkdown
    ?? detail.optimizedResume?.markdown
    ?? detail.optimizedResume?.afterMarkdown
    ?? detail.markdownPreview
    ?? ''

  return {
    resumeId: detail.resumeId,
    versionId: detail.versionId,
    targetRole: detail.targetRole,
    beforeMarkdown: detail.optimizedResume?.beforeMarkdown ?? '',
    afterMarkdown: markdown,
    score: { before: Math.max(score - 10, 0), after: score },
    stats: { total: 0, added: 0, optimized: 0, removed: 0 },
    summary: detail.summary ?? detail.analysis?.summary ?? detail.analysis?.oneSentenceConclusion ?? '历史版本已加载。',
    suggestions: detail.analysis?.actionItems ?? [],
    changes: detail.optimizedResume?.changes ?? [],
  }
}

function detailToAnalyzeResult(detail: ResumeVersionHistoryDetail): AnalyzeResumeResult {
  const diff = detail.diff ?? fallbackDiff(detail)
  const score = detail.analysis?.score ?? detail.score ?? diff.score.after
  const matchRate = detail.analysis?.matchRate ?? detail.matchRate ?? score
  const issues = Array.isArray(detail.analysis?.mainProblems)
    ? detail.analysis.mainProblems.map(normalizeIssue)
    : []
  const analysis: AnalysisResult = {
    analysisId: detail.analysisId,
    resumeId: detail.resumeId,
    versionId: detail.versionId,
    score,
    matchRate,
    grade: normalizeGrade(detail.analysis?.grade, score),
    summary: detail.summary ?? detail.analysis?.summary ?? detail.analysis?.oneSentenceConclusion ?? diff.summary,
    oneSentenceConclusion: detail.analysis?.oneSentenceConclusion,
    issues,
    keywords: detail.analysis?.missingKeywords ?? diff.suggestions ?? [],
    valueExtraction: detail.analysis?.valueExtraction ?? [],
    actionItems: detail.analysis?.actionItems ?? diff.suggestions ?? [],
    questionsToAsk: detail.analysis?.questionsToAsk ?? [],
    isPlaceholder: false,
  }

  return {
    resumeId: detail.resumeId,
    analysisId: detail.analysisId ?? detail.historyId,
    versionId: detail.versionId,
    remaining: 0,
    usage: defaultUsage,
    analysis,
    optimizedResume: {
      ...detail.optimizedResume,
      markdown: diff.afterMarkdown,
      diff,
      beforeMarkdown: diff.beforeMarkdown,
      afterMarkdown: diff.afterMarkdown,
      score: diff.score,
      stats: diff.stats,
      summary: diff.summary,
      suggestions: diff.suggestions,
      changes: diff.changes,
      targetRole: diff.targetRole,
      isPlaceholder: false,
    },
    lapisMarkdown: detail.lapisMarkdown ?? diff.afterMarkdown,
    targetRole: detail.targetRole ?? diff.targetRole,
    beforeMarkdown: diff.beforeMarkdown,
    afterMarkdown: diff.afterMarkdown,
    score: diff.score,
    stats: diff.stats,
    summary: diff.summary,
    suggestions: diff.suggestions,
    changes: diff.changes,
    diff,
  }
}

function previewText(markdown?: string) {
  if (!markdown) return '暂无预览内容'
  return markdown.replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140) || '暂无预览内容'
}

export function DashboardHistoryPage({
  go,
  setAnalyzeResult,
  setJobDescription,
  setJobStage,
  setOptimizeLevel,
  setOriginalName,
  setOutputLanguage,
  setResumeText,
  setSourceResumeId,
  setTargetJob,
}: DashboardHistoryPageProps) {
  const [items, setItems] = useState<ResumeVersionHistoryItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ResumeVersionHistoryDetail | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [targetRole, setTargetRoleFilter] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roles = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.targetRole).filter(Boolean))).slice(0, 8) as string[]
  }, [items])

  const fetchHistory = useCallback(async (cursor?: string, append = false) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const result = await listResumeVersionHistory({
        cursor,
        limit: 12,
        q: q.trim() || undefined,
        targetRole: targetRole || undefined,
        includeArchived,
      })
      setItems((current) => append ? [...current, ...result.items] : result.items)
      setNextCursor(result.pageInfo.nextCursor)
      setHasMore(result.pageInfo.hasMore)
    } catch (requestError) {
      const message = requestError instanceof ApiRequestError ? requestError.message : '历史记录加载失败，请稍后重试。'
      setError(message)
    } finally {
      if (append) {
        setIsLoadingMore(false)
      } else {
        setIsLoading(false)
      }
    }
  }, [includeArchived, q, targetRole])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchHistory()
    }, 250)

    return () => window.clearTimeout(timer)
  }, [fetchHistory])

  async function loadDetail(historyId: string) {
    setDetailLoadingId(historyId)
    try {
      const data = await getResumeVersionHistory(historyId)
      setActiveId(historyId)
      setDetail(data)
      return data
    } catch (requestError) {
      notifyError(requestError instanceof ApiRequestError ? requestError.message : '历史详情加载失败。')
      return null
    } finally {
      setDetailLoadingId(null)
    }
  }

  async function openResult(historyId: string) {
    const data = detail?.historyId === historyId ? detail : await loadDetail(historyId)
    if (!data) return
    setAnalyzeResult(detailToAnalyzeResult(data))
    go('result', { params: { id: data.versionId } })
  }

  async function openEditor(historyId: string) {
    const data = detail?.historyId === historyId ? detail : await loadDetail(historyId)
    if (!data) return
    setAnalyzeResult(detailToAnalyzeResult(data))
    go('edit', { params: { id: data.versionId } })
  }

  function applyEditorPayload(payload?: HistoryEditorPayload) {
    if (!payload) {
      notifyError('该历史记录没有可回填的优化表单数据。')
      return false
    }

    setSourceResumeId(payload.sourceResumeId)
    setResumeText(payload.resumeText ?? '')
    setOriginalName(payload.originalName)
    setTargetJob(payload.targetJob ?? '')
    setJobDescription(payload.jobDescription ?? '')
    setJobStage(payload.jobStage ?? 'internship')
    setOutputLanguage(payload.outputLanguage ?? 'zh')
    setOptimizeLevel(payload.optimizeLevel ?? 'standard')
    return true
  }

  async function refillOptimizer(historyId: string) {
    const data = detail?.historyId === historyId ? detail : await loadDetail(historyId)
    if (!data || !applyEditorPayload(data.editorPayload)) return
    notifySuccess('历史参数已回填到优化表单。')
    go('optimizer')
  }

  async function restoreHistory(historyId: string) {
    setDetailLoadingId(historyId)
    try {
      const restored = await restoreResumeVersionHistory(historyId, {
        restoreMode: 'newVersion',
        versionName: `恢复版本 - ${new Date().toLocaleDateString('zh-CN')}`,
      })
      if (restored.editorPayload) applyEditorPayload(restored.editorPayload)
      notifySuccess('历史版本已恢复为新版本。')
      await fetchHistory()
    } catch (requestError) {
      notifyError(requestError instanceof ApiRequestError ? requestError.message : '恢复历史版本失败。')
    } finally {
      setDetailLoadingId(null)
    }
  }

  async function toggleArchive(item: ResumeVersionHistoryItem) {
    setDetailLoadingId(item.historyId)
    try {
      if (item.archived) {
        await unarchiveResumeVersionHistory(item.historyId)
        notifySuccess('已取消归档。')
      } else {
        await archiveResumeVersionHistory(item.historyId)
        notifySuccess('已归档该历史记录。')
      }
      await fetchHistory()
      if (activeId === item.historyId) setDetail(null)
    } catch (requestError) {
      notifyError(requestError instanceof ApiRequestError ? requestError.message : '操作失败，请稍后重试。')
    } finally {
      setDetailLoadingId(null)
    }
  }

  return (
    <section className="page history-page">
      <div className="page-heading history-heading">
        <div>
          <span className="eyebrow">历史版本</span>
          <h2>查看之前的简历优化数据</h2>
          <p className="page-subtitle">按后端历史版本快照回显分析结果、优化版简历和可恢复的表单参数。</p>
        </div>
        <button className="button button--ghost" onClick={() => fetchHistory()} type="button">
          <RefreshCw size={16} /> 刷新
        </button>
      </div>

      <div className="history-filters">
        <label className="history-search">
          <Search size={18} />
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索文件名、标题或岗位" />
        </label>
        <label className="history-select">
          <Filter size={17} />
          <select value={targetRole} onChange={(event) => setTargetRoleFilter(event.target.value)}>
            <option value="">全部岗位</option>
            {roles.map((role) => (
              <option value={role} key={role}>{role}</option>
            ))}
          </select>
        </label>
        <label className="history-archive-toggle">
          <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
          包含已归档
        </label>
      </div>

      <div className="history-layout">
        <div className="history-list">
          {isLoading && (
            <div className="history-state">
              <Loader2 className="spin" size={22} />
              正在加载历史记录...
            </div>
          )}

          {!isLoading && error && (
            <div className="history-state history-state--error">
              <strong>加载失败</strong>
              <span>{error}</span>
              <button className="button button--ghost button--small" onClick={() => fetchHistory()} type="button">重试</button>
            </div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <div className="history-state">
              <History size={28} />
              <strong>还没有历史记录</strong>
              <span>完成一次 AI 优化后，后端返回的版本快照会出现在这里。</span>
              <button className="button button--primary button--small" onClick={() => go('optimizer')} type="button">去优化简历</button>
            </div>
          )}

          {!isLoading && !error && items.map((item) => (
            <article className={`history-card ${activeId === item.historyId ? 'is-active' : ''}`} key={item.historyId}>
              <div className="history-card__top">
                <span className={`history-score ${item.score && item.score > 85 ? 'is-strong' : ''}`}>
                  {item.score ?? '--'}
                  <small>分</small>
                </span>
                <div>
                  <h3>{item.title || '未命名简历'}</h3>
                  <p>{item.targetRole || '未填写目标岗位'} · {formatDate(item.createdAt)}</p>
                </div>
                {item.archived && <span className="history-badge">已归档</span>}
              </div>

              <p className="history-summary">{item.summary || previewText(item.markdownPreview)}</p>

              <div className="history-meta">
                <span>版本：{item.versionName || item.versionId}</span>
                <span>匹配度：{item.matchRate ?? '--'}%</span>
                <span>来源：{item.sourceType || 'text'}</span>
              </div>

              <div className="history-actions">
                <button onClick={() => loadDetail(item.historyId)} type="button">
                  <Eye size={15} /> 详情
                </button>
                <button onClick={() => openResult(item.historyId)} type="button">
                  <FileText size={15} /> 分析
                </button>
                <button onClick={() => openEditor(item.historyId)} type="button">
                  <FileText size={15} /> 编辑
                </button>
                <button disabled={!item.canRestore || detailLoadingId === item.historyId} onClick={() => restoreHistory(item.historyId)} type="button">
                  <RotateCcw size={15} /> 恢复
                </button>
                <button onClick={() => toggleArchive(item)} type="button">
                  {item.archived ? <Undo2 size={15} /> : <Archive size={15} />}
                  {item.archived ? '取消归档' : '归档'}
                </button>
              </div>
            </article>
          ))}

          {!isLoading && !error && hasMore && (
            <button className="button button--ghost history-more" disabled={isLoadingMore} onClick={() => fetchHistory(nextCursor ?? undefined, true)} type="button">
              {isLoadingMore ? <Loader2 className="spin" size={16} /> : null}
              {isLoadingMore ? '加载中...' : '加载更多'}
            </button>
          )}
        </div>

        <aside className="history-detail">
          {!detail && (
            <div className="history-detail__empty">
              <History size={30} />
              <strong>选择一条历史记录</strong>
              <span>这里会展示历史快照里的评分、摘要、Markdown 预览和回填入口。</span>
            </div>
          )}

          {detail && (
            <>
              <div className="history-detail__head">
                <span className="eyebrow">历史详情</span>
                <h3>{detail.title}</h3>
                <p>{detail.targetRole || '未填写目标岗位'} · {formatDate(detail.updatedAt ?? detail.createdAt)}</p>
              </div>

              <div className="history-detail__metrics">
                <span><b>{detail.score ?? detail.analysis?.score ?? '--'}</b>综合评分</span>
                <span><b>{detail.matchRate ?? detail.analysis?.matchRate ?? '--'}%</b>岗位匹配</span>
                <span><b>{detail.diff?.stats.total ?? detail.optimizedResume?.stats?.total ?? 0}</b>修改项</span>
              </div>

              <p className="history-detail__summary">
                {detail.summary ?? detail.analysis?.summary ?? detail.analysis?.oneSentenceConclusion ?? '后端未返回摘要。'}
              </p>

              <div className="history-preview">
                <span>优化版 Markdown 预览</span>
                <pre>{previewText(detail.diff?.afterMarkdown ?? detail.lapisMarkdown ?? detail.optimizedResume?.markdown ?? detail.markdownPreview)}</pre>
              </div>

              <div className="history-detail__actions">
                <button className="button button--primary" onClick={() => openEditor(detail.historyId)} type="button">查看并编辑</button>
                <button className="button button--ghost" onClick={() => openResult(detail.historyId)} type="button">查看分析结果</button>
                <button className="button button--ghost" onClick={() => refillOptimizer(detail.historyId)} type="button">回填优化表单</button>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

export default DashboardHistoryPage
