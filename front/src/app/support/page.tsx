import { SupportPanel } from '../../components/support/SupportPanel'
import type { Navigate } from '../../types/navigation'

export function SupportPage({ go }: { go: Navigate }) {
  return <SupportPanel go={go} />
}

export default SupportPage
