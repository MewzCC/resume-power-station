import { Copy, Download, Eye, FileDown, Save, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ChangePanel } from '../../../../components/resume/ChangePanel'
import { MarkdownResume } from '../../../../components/resume/MarkdownResume'
import { OptimizeScoreSummary } from '../../../../components/resume/OptimizeScoreSummary'
import { ResumeDiffView } from '../../../../components/resume/ResumeDiffView'
import {
  ApiRequestError,
  exportResumeDocx,
  exportResumePdf,
  getResumeDiff,
  saveResumeVersion,
} from '../../../../lib/api'
import { notifyError, notifySuccess } from '../../../../lib/error-events'
import { placeholderOptimizedResume } from '../../../../lib/placeholders'
import type { Navigate } from '../../../../types/navigation'
import type { OptimizedResume, ResumeDiffData } from '../../../../types/resume'

type EditPageProps = {
  go: Navigate
  optimizedResume?: OptimizedResume | null
  resumeId?: string
  versionId?: string
}

function openDownload(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function isRealId(value?: string): value is string {
  return Boolean(value && value !== 'latest' && value !== 'demo')
}

export function EditPage({ optimizedResume, resumeId, versionId }: EditPageProps) {
  const hasRealAnalysis = Boolean(optimizedResume && !optimizedResume.isPlaceholder)
  const remoteVersion = useMemo(() => {
    return hasRealAnalysis && isRealId(resumeId) && isRealId(versionId)
      ? { resumeId, versionId }
      : null
  }, [hasRealAnalysis, resumeId, versionId])
  const canUseRemoteVersion = Boolean(remoteVersion)
  const initialDiff = useMemo<ResumeDiffData>(() => {
    return optimizedResume?.diff ?? placeholderOptimizedResume.diff as ResumeDiffData
  }, [optimizedResume])
  const diffKey = `${resumeId ?? 'demo'}:${versionId ?? 'demo'}`
  const [remoteDiff, setRemoteDiff] = useState<{ key: string; data: ResumeDiffData } | null>(null)
  const [draftAfter, setDraftAfter] = useState<{ key: string; markdown: string } | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState<'pdf' | 'docx' | null>(null)
  const baseDiff = remoteDiff?.key === diffKey ? remoteDiff.data : initialDiff
  const diff = {
    ...baseDiff,
    afterMarkdown: draftAfter?.key === diffKey ? draftAfter.markdown : baseDiff.afterMarkdown,
  }

  useEffect(() => {
    if (!canUseRemoteVersion || optimizedResume?.diff) return

    if (!remoteVersion) return

    void getResumeDiff(remoteVersion.resumeId, remoteVersion.versionId)
      .then((data) => setRemoteDiff({ key: `${remoteVersion.resumeId}:${remoteVersion.versionId}`, data }))
      .catch((error) => {
        if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') return
        notifyError(error instanceof ApiRequestError ? error.message : '获取简历对比数据失败。')
      })
  }, [canUseRemoteVersion, optimizedResume?.diff, remoteVersion])

  async function copyMarkdown() {
    await navigator.clipboard?.writeText(diff.afterMarkdown)
    notifySuccess('已复制优化后的 Markdown 简历。')
  }

  async function handleSave() {
    if (!remoteVersion) {
      notifyError('当前是演示界面，完成一次真实 AI 分析后才能保存版本。')
      return
    }

    setIsSaving(true)
    try {
      await saveResumeVersion(remoteVersion.versionId, {
        markdown: diff.afterMarkdown,
        changes: diff.changes,
        theme: 'lapis-cv',
      })
      notifySuccess('当前优化版本已保存。')
    } catch (error) {
      notifyError(error instanceof ApiRequestError ? error.message : '保存版本失败，请稍后重试。')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExport(type: 'pdf' | 'docx') {
    if (!remoteVersion) {
      notifyError('当前是演示界面，完成一次真实 AI 分析后才能调用后端导出。')
      return
    }

    setIsExporting(type)
    try {
      const payload = {
        versionId: remoteVersion.versionId,
        markdown: diff.afterMarkdown,
        theme: 'lapis-cv' as const,
        filename: `resume-${diff.targetRole ?? 'optimized'}.${type}`,
      }
      const result = type === 'pdf'
        ? await exportResumePdf(remoteVersion.resumeId, payload)
        : await exportResumeDocx(remoteVersion.resumeId, payload)
      notifySuccess(type === 'pdf' ? 'PDF 已生成，正在打开下载地址。' : 'Word 已生成，正在打开下载地址。')
      openDownload(result.downloadUrl)
    } catch (error) {
      notifyError(error instanceof ApiRequestError ? error.message : '导出失败，请稍后重试。')
    } finally {
      setIsExporting(null)
    }
  }

  return (
    <>
      <section className="page compare-page">
        {!canUseRemoteVersion && (
          <article className="demo-banner">
            <strong>当前是演示界面</strong>
            <span>完成一次真实 AI 分析后，保存、导出和远程对比接口才会发起请求。</span>
          </article>
        )}

        <div className="editor-toolbar compare-toolbar">
          <button className="icon-action" disabled={isSaving} onClick={handleSave} type="button">
            <Save size={18} />{isSaving ? '保存中' : '保存版本'}
          </button>
          <button className="icon-action" onClick={copyMarkdown} type="button">
            <Copy size={18} />复制 Markdown
          </button>
          <button className="icon-action" onClick={() => setIsPreviewOpen(true)} type="button">
            <Eye size={18} />全局预览
          </button>
          <button className="icon-action" disabled={isExporting === 'docx'} onClick={() => handleExport('docx')} type="button">
            <Download size={18} />{isExporting === 'docx' ? '导出中' : '导出 Word'}
          </button>
          <button className="icon-action" disabled={isExporting === 'pdf'} onClick={() => handleExport('pdf')} type="button">
            <FileDown size={18} />{isExporting === 'pdf' ? '导出中' : '导出 PDF'}
          </button>
        </div>

        <OptimizeScoreSummary diff={diff} />

        <div className="compare-shell">
          <ResumeDiffView
            diff={diff}
            onAfterMarkdownChange={(markdown) => setDraftAfter({ key: diffKey, markdown })}
            onOpenPreview={() => setIsPreviewOpen(true)}
          />
          <ChangePanel changes={diff.changes} />
        </div>
      </section>

      {isPreviewOpen && (
        <div className="preview-modal" role="dialog" aria-modal="true" aria-label="全局简历预览">
          <div className="preview-modal__panel preview-modal__panel--wide">
            <header>
              <div>
                <span className="eyebrow">LapisCV 全局预览</span>
                <h2>优化后完整简历</h2>
              </div>
              <button className="icon-button" onClick={() => setIsPreviewOpen(false)} type="button" aria-label="关闭预览">
                <X size={18} />
              </button>
            </header>
            <div className="global-preview-paper">
              <MarkdownResume markdown={diff.afterMarkdown} changes={diff.changes} mode="after" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default EditPage
