import { FileText } from 'lucide-react'
import { buildPreviewData } from '../../lib/analysis-adapter'
import type { Navigate } from '../../types/navigation'
import type { OptimizedResume, ResumeEditorSection, ResumePreviewData } from '../../types/resume'

type ExportStatus = {
  label: string
  progress: number
  state: 'idle' | 'running' | 'done' | 'failed'
}

type ResumePreviewProps = {
  exportStatus?: ExportStatus
  go: Navigate
  onOpenPreview?: () => void
  optimizedResume?: OptimizedResume | null
  preview?: ResumePreviewData
  sections?: ResumeEditorSection[]
}

export function ResumePreview({ exportStatus, go, onOpenPreview, optimizedResume, preview, sections }: ResumePreviewProps) {
  const data = preview ?? buildPreviewData(optimizedResume ?? undefined)
  const progress = Math.max(0, Math.min(exportStatus?.progress ?? 0, 100))
  const totalSections = sections?.length ?? optimizedResume?.editorSections?.length ?? 0

  return (
    <aside className="resume-preview">
      <div className="lapis-switch">
        <button className={data.theme === 'lapis-cv' ? 'is-selected' : ''} type="button">LapisCV</button>
        <button className={data.theme === 'lapis-cv-serif' ? 'is-selected' : ''} type="button">Serif</button>
      </div>
      <div className="paper-preview">
        {data.isPlaceholder && <span className="preview-badge">预览</span>}
        <h4>{data.name}</h4>
        <p>{data.title}</p>
        <div className="preview-lines">
          {data.lines.map((line) => <span key={line}>{line}</span>)}
        </div>
        {totalSections > 0 && <small className="preview-count">{totalSections} 个模块</small>}
        <button className="play-button" onClick={onOpenPreview} type="button" aria-label="打开全局预览">
          <FileText size={22} />
        </button>
      </div>
      {exportStatus?.state === 'running' && (
        <div className="progress-toast">
          <span>{exportStatus.label}</span>
          <div><i style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      <button className="button button--ghost" onClick={() => go('support')} type="button" style={{ margin: '5px 0' }}>
        去赞助支持
      </button>
    </aside>
  )
}
