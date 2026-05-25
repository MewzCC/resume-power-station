import { Check, Columns2, Maximize2, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { ResumeDiffData } from '../../types/resume'
import { MarkdownResume } from './MarkdownResume'

type ResumeDiffViewProps = {
  diff: ResumeDiffData
  onAfterMarkdownChange: (markdown: string) => void
  onOpenPreview: () => void
}

export function ResumeDiffView({ diff, onAfterMarkdownChange, onOpenPreview }: ResumeDiffViewProps) {
  const [view, setView] = useState<'compare' | 'after'>('compare')
  const [isEditing, setIsEditing] = useState(false)

  return (
    <section className="diff-workbench">
      <header className="diff-workbench__header">
        <div>
          <span>修改前（原始简历）</span>
          <strong>AI 优化后{diff.targetRole ? `（针对 ${diff.targetRole} 岗位）` : ''}</strong>
        </div>
        <div className="diff-view-actions">
          <button className={view === 'compare' ? 'is-active' : ''} onClick={() => setView('compare')} type="button">
            <Columns2 size={16} /> 对比视图
          </button>
          <button className={view === 'after' ? 'is-active' : ''} onClick={() => setView('after')} type="button">
            <Maximize2 size={16} /> 优化后预览
          </button>
          <button onClick={onOpenPreview} type="button">全屏预览</button>
        </div>
      </header>

      <div className={view === 'compare' ? 'diff-columns' : 'diff-columns diff-columns--single'}>
        {view === 'compare' && (
          <div className="resume-paper-shell">
            <span className="paper-label">修改前</span>
            <MarkdownResume markdown={diff.beforeMarkdown} changes={diff.changes} mode="before" />
          </div>
        )}
        <div className="resume-paper-shell resume-paper-shell--after">
          <div className="editable-paper-head">
            <span className="paper-label">{isEditing ? '正在编辑修改后版本' : '修改后预览'}</span>
            <button className="edit-toggle" onClick={() => setIsEditing((current) => !current)} type="button">
              {isEditing ? <Check size={16} /> : <Pencil size={16} />}
              {isEditing ? '完成编辑' : '编辑此版本'}
            </button>
          </div>
          {isEditing ? (
            <textarea
              className="markdown-edit-area"
              value={diff.afterMarkdown}
              onChange={(event) => onAfterMarkdownChange(event.target.value)}
              spellCheck={false}
              aria-label="编辑优化后的 Markdown 简历"
            />
          ) : (
            <>
              <p className="edit-hint">当前为预览模式。需要调整内容时，点击“编辑此版本”。保存、复制、导出会使用编辑后的最新内容。</p>
              <MarkdownResume markdown={diff.afterMarkdown} changes={diff.changes} mode="after" />
            </>
          )}
        </div>
      </div>
    </section>
  )
}
