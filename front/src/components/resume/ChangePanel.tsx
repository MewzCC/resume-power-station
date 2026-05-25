import { ChevronDown, ListFilter } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ResumeChange, ResumeChangeType } from '../../types/resume'

type ChangePanelProps = {
  changes: ResumeChange[]
}

const labels: Record<ResumeChangeType | 'all', string> = {
  all: '全部',
  added: '新增',
  optimized: '优化',
  removed: '删除',
}

function scrollToChange(id: string) {
  const target = document.querySelector(`[data-change-id="${id}"]`)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target.classList.add('resume-highlight-pulse')
  window.setTimeout(() => target.classList.remove('resume-highlight-pulse'), 1200)
}

export function ChangePanel({ changes }: ChangePanelProps) {
  const [filter, setFilter] = useState<ResumeChangeType | 'all'>('all')
  const visibleChanges = filter === 'all' ? changes : changes.filter((item) => item.type === filter)
  const grouped = useMemo(() => {
    return visibleChanges.reduce<Record<string, ResumeChange[]>>((acc, change) => {
      const key = change.section || '未分组'
      acc[key] = [...(acc[key] ?? []), change]
      return acc
    }, {})
  }, [visibleChanges])

  return (
    <aside className="change-panel" aria-label="AI 修改详情">
      <header>
        <div>
          <span><ListFilter size={16} /> AI 修改详情</span>
          <strong>共 {changes.length} 处修改</strong>
        </div>
      </header>

      <div className="change-filter" role="tablist" aria-label="修改类型筛选">
        {(['all', 'added', 'optimized', 'removed'] as const).map((item) => (
          <button
            aria-selected={filter === item}
            className={filter === item ? 'is-active' : ''}
            key={item}
            onClick={() => setFilter(item)}
            type="button"
          >
            {labels[item]}
          </button>
        ))}
      </div>

      <div className="change-groups">
        {Object.entries(grouped).map(([section, items]) => (
          <section key={section}>
            <h3>
              <ChevronDown size={16} />
              {section} <span>({items.length} 处)</span>
            </h3>
            {items.map((item) => (
              <button className="change-item" key={item.id} onClick={() => scrollToChange(item.id)} type="button">
                <span className={`change-tag change-tag--${item.type}`}>{labels[item.type]}</span>
                <strong>{item.title ?? item.reason}</strong>
                <p>{item.after ?? item.before ?? item.impact}</p>
                {item.impact && <small>{item.impact}</small>}
              </button>
            ))}
          </section>
        ))}
      </div>
    </aside>
  )
}
