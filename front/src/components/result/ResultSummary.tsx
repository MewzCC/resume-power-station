import { Copy, Share2 } from 'lucide-react'
import { placeholderAnalysis } from '../../lib/placeholders'
import { notify, notifySuccess } from '../../lib/error-events'
import type { AnalysisResult } from '../../types/analysis'
import type { Navigate } from '../../types/navigation'
import { Metric } from '../ui/Metric'

type ResultSummaryProps = {
  analysis?: AnalysisResult | null
  go: Navigate
}

function normalizeLevel(level: string) {
  if (level === 'high') return '高'
  if (level === 'medium') return '中'
  if (level === 'low') return '低'
  return level
}

export function ResultSummary({ analysis, go }: ResultSummaryProps) {
  const data = analysis ?? placeholderAnalysis
  const isPlaceholder = data.isPlaceholder ?? !analysis

  return (
    <section className="page result-layout">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{isPlaceholder ? '示例' : '分析结果'}</span>
          <h2>{isPlaceholder ? '还没有真实分析结果' : '简历审计结果'}</h2>
          {isPlaceholder && <p className="page-subtitle">完成一次 AI 分析后，这里会展示真实的分析内容。</p>}
        </div>
        <div className="result-heading-actions">
          <button
            className="button button--ghost"
            onClick={() => {
              if (!data.analysisId) {
                notify('分享结果需要后端返回 analysisId 后生成分享链接。')
                return
              }
              notifySuccess('分享链接已准备好。')
            }}
            type="button"
          >
            <Share2 size={16} /> 分享结果
          </button>
          <button className="button button--primary" onClick={() => go('edit')} type="button">
            查看优化版简历
          </button>
          <button className="button button--ghost" onClick={() => notifySuccess('已复制当前分析内容。')} type="button">
            <Copy size={16} /> 复制结果
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <Metric title="综合评分" value={String(data.score)} unit="/100" />
        <Metric title="匹配度" value={String(data.matchRate)} unit="%" />
        <Metric title="等级" value={data.grade} tone="green" />
      </div>

      <article className="result-card">
        <p className="summary">{data.summary || data.oneSentenceConclusion}</p>
        <h3>关键问题</h3>
        <div className="issue-list">
          {data.issues.map((issue) => (
            <span key={`${issue.level}-${issue.text}`}>
              <b>{normalizeLevel(issue.level)}</b>
              {issue.text}
              {issue.suggestion && <small>{issue.suggestion}</small>}
            </span>
          ))}
        </div>
        <h3>关键词覆盖情况</h3>
        <div className="tag-cloud">
          {data.keywords.map((word, index) => (
            <span className={index % 3 === 0 ? 'tag tag--warn' : 'tag'} key={word}>
              {word}
            </span>
          ))}
        </div>
      </article>

      <article className="result-card">
        <h3>价值提炼</h3>
        <table>
          <thead>
            <tr>
              <th>经历模块</th>
              <th>现在的问题</th>
              <th>增强方向</th>
            </tr>
          </thead>
          <tbody>
            {(data.valueExtraction ?? []).map((row) => (
              <tr key={`${row.module}-${row.currentProblem}`}>
                <td>{row.module}</td>
                <td>{row.currentProblem}</td>
                <td>{row.direction}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>下一步行动清单</h3>
        <ol className="action-list">
          {(data.actionItems ?? []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </article>
    </section>
  )
}
