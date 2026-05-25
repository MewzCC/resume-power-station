import type { AnalysisResult } from '../../types/analysis'

export function ScoreCard({ analysis, isLoading = false }: { analysis: AnalysisResult; isLoading?: boolean }) {
  const keywords = analysis.keywords.slice(0, 2).join(' / ')
  const title = analysis.isPlaceholder ? '最近一次综合评分' : '最近一次综合评分'

  return (
    <article className="score-card">
      <span>{isLoading ? '正在同步历史评分' : title}</span>
      <strong>
        {isLoading ? '--' : analysis.score}<small>/100</small>
      </strong>
      <div className="score-line">
        <i style={{ width: `${isLoading ? 34 : Math.max(0, Math.min(100, analysis.score))}%` }} />
      </div>
      <p>{isLoading ? '正在拉取最近一次历史记录。' : keywords ? `关键词：${keywords}` : analysis.summary}</p>
    </article>
  )
}
