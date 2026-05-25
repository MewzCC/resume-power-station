import { ResultSummary } from '../../../../components/result/ResultSummary'
import type { AnalysisResult } from '../../../../types/analysis'
import type { Navigate } from '../../../../types/navigation'

export function ResultPage({ analysis, go }: { analysis?: AnalysisResult | null; go: Navigate }) {
  return <ResultSummary analysis={analysis} go={go} />
}

export default ResultPage
