import { CloudUpload, FileDown, Heart, Sparkles, WandSparkles, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { features } from '../lib/constants'
import { listResumeVersionHistory } from '../lib/api'
import { placeholderAnalysis } from '../lib/placeholders'
import type { ResumeVersionHistoryItem, TodayUsage } from '../types/api'
import type { AnalysisResult } from '../types/analysis'
import type { Navigate } from '../types/navigation'
import { QuotaCard } from '../components/ui/QuotaCard'
import { ScoreCard } from '../components/ui/ScoreCard'
import { StepIcon } from '../components/ui/StepIcon'

type HomePageProps = {
  analysis?: AnalysisResult | null
  go: Navigate
  isAuthenticated: boolean
  isCheckingAuth: boolean
  usage: TodayUsage | null
}

function scoreToGrade(score: number) {
  if (score >= 85) return '优秀'
  if (score >= 75) return '良好'
  if (score >= 60) return '可优化'
  return '需加强'
}

function historyItemToAnalysis(item: ResumeVersionHistoryItem): AnalysisResult {
  const score = item.score ?? 75
  return {
    score,
    matchRate: item.matchRate ?? Math.max(50, Math.min(96, score - 5)),
    grade: scoreToGrade(score),
    summary: item.summary ?? `最近优化：${item.title}`,
    keywords: [item.targetRole, item.versionName].filter(Boolean) as string[],
    issues: [],
    actionItems: [],
    valueExtraction: [],
  }
}

export function HomePage({ analysis, go, isAuthenticated, isCheckingAuth, usage }: HomePageProps) {
  const [latestHistoryAnalysis, setLatestHistoryAnalysis] = useState<AnalysisResult | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return undefined

    let ignore = false

    void listResumeVersionHistory({ limit: 1 }, { silentErrors: true })
      .then((result) => {
        if (ignore) return
        setLatestHistoryAnalysis(result.items[0] ? historyItemToAnalysis(result.items[0]) : null)
      })
      .catch(() => {
        if (!ignore) setLatestHistoryAnalysis(null)
      })

    return () => {
      ignore = true
    }
  }, [isAuthenticated])

  const displayAnalysis = useMemo(() => {
    if (analysis && !analysis.isPlaceholder) return analysis
    if (isAuthenticated && latestHistoryAnalysis) return latestHistoryAnalysis
    return placeholderAnalysis
  }, [analysis, isAuthenticated, latestHistoryAnalysis])

  return (
    <section className="page home-grid">
      <div className="hero-copy">
        <span className="eyebrow">
          <Sparkles size={16} /> 公益免费版
        </span>
        <h1>
          给大学生的
          <span> 免费 AI </span>
          简历优化助手
        </h1>
        <p>
          上传简历，粘贴目标岗位 JD，AI 帮你分析差距、优化表达、生成更适合投递的简历版本。
          每天免费优化 3 次。
        </p>
        <div className="hero-actions">
          <button className="button button--primary" onClick={() => go('optimizer')} type="button">
            <Zap size={18} fill="currentColor" /> 开始免费优化
          </button>
          <button className="button button--ghost" onClick={() => go('support')} type="button">
            <Heart size={18} /> 赞助一下
          </button>
        </div>
      </div>

      <aside className="hero-panel">
        <QuotaCard isAuthenticated={isAuthenticated} isLoading={isCheckingAuth} usage={usage} />
        <ScoreCard analysis={displayAnalysis} />
        <div className="mini-flow">
          <h3>三步完成优化</h3>
          <div>
            <StepIcon icon={<CloudUpload />} label="上传简历" />
            <StepIcon icon={<WandSparkles />} label="AI 分析" />
            <StepIcon icon={<FileDown />} label="导出版本" />
          </div>
        </div>
      </aside>

      <FeatureGrid />
    </section>
  )
}

function FeatureGrid() {
  return (
    <div className="feature-grid">
      {features.map(([title, body]) => (
        <article className="feature-card" key={title}>
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
    </div>
  )
}

export default HomePage
