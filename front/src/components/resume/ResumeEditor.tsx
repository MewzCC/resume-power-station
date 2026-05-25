import { CheckCircle2, FileText } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildEditorSections } from '../../lib/analysis-adapter'
import type { OptimizedResume, ResumeEditorSection } from '../../types/resume'

type ResumeEditorProps = {
  optimizedResume?: OptimizedResume | null
  onSectionsChange?: (sections: ResumeEditorSection[]) => void
}

export function ResumeEditor({ optimizedResume, onSectionsChange }: ResumeEditorProps) {
  const sections = useMemo(() => buildEditorSections(optimizedResume ?? undefined), [optimizedResume])
  const [activeId, setActiveId] = useState(sections[0]?.id ?? 'profile')
  const activeSection = sections.find((section) => section.id === activeId) ?? sections[0]
  const isPlaceholder = !optimizedResume || optimizedResume.isPlaceholder

  function updateSection(value: string) {
    if (!activeSection) return
    onSectionsChange?.(
      sections.map((section) => section.id === activeSection.id ? { ...section, optimized: value } : section),
    )
  }

  return (
    <>
      <aside className="editor-tabs" aria-label="简历模块">
        {sections.map((item) => (
          <button
            className={item.id === activeSection?.id ? 'is-active' : ''}
            key={item.id}
            onClick={() => setActiveId(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </aside>

      <article className="resume-editor">
        {isPlaceholder && (
          <p className="editor-placeholder">当前展示为演示数据。完成分析后，这里会显示后端返回的原文对照、优化版本和优化理由。</p>
        )}
        {activeSection && (
          <section>
            <div className="review-heading">
              <div>
                <span className="eyebrow"><FileText size={15} /> 模块对照</span>
                <h3>{activeSection.label}</h3>
              </div>
              <span className="review-status"><CheckCircle2 size={15} /> 已生成优化建议</span>
            </div>

            <div className="diff-grid">
              <div className="diff-panel diff-panel--source">
                <span>原文</span>
                <p>{activeSection.original || '后端未返回该模块原文。建议在 editorSections.original 中补充，便于用户确认 AI 改动依据。'}</p>
              </div>
              <label className="diff-panel diff-panel--optimized">
                <span>优化后</span>
                <textarea
                  key={activeSection.id}
                  defaultValue={activeSection.optimized}
                  onBlur={(event) => updateSection(event.target.value)}
                />
              </label>
            </div>
            {activeSection.reason && (
              <div className="reason-box">
                <strong>AI 优化理由</strong>
                <p>{activeSection.reason}</p>
              </div>
            )}
            {activeSection.items?.length && (
              <div className="skill-bars">
                {activeSection.items.map((item) => <span key={item}>{item}</span>)}
              </div>
            )}
          </section>
        )}
      </article>
    </>
  )
}
