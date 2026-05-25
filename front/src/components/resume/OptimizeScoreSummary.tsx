import { Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { ResumeDiffData } from '../../types/resume'

type OptimizeScoreSummaryProps = {
  diff: ResumeDiffData
}

export function OptimizeScoreSummary({ diff }: OptimizeScoreSummaryProps) {
  const score = Math.max(0, Math.min(diff.score.after, 100))
  const grade = score > 85 ? '优秀' : score > 70 ? '良好' : '待优化'

  return (
    <section className="optimize-summary" aria-label="AI 优化建议总结">
      <div className="score-ring" style={{ '--score': `${score * 3.6}deg` } as CSSProperties & Record<string, string>}>
        <strong>{diff.score.after}</strong>
        <span>{grade}</span>
      </div>

      <div className="optimize-summary__copy">
        <span><Sparkles size={16} /> AI 优化建议总结</span>
        <p>{diff.summary}</p>
      </div>

      <div className="change-stats" aria-label="修改数量统计">
        <strong>{diff.stats.total}<span>修改项</span></strong>
        <strong>{diff.stats.optimized}<span>优化项</span></strong>
        <strong>{diff.stats.added}<span>新增项</span></strong>
        <strong>{diff.stats.removed}<span>删除项</span></strong>
      </div>
    </section>
  )
}
