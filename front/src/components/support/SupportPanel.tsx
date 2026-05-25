import { Heart, Zap } from 'lucide-react'
import { notify } from '../../lib/error-events'
import type { Navigate } from '../../types/navigation'
import { QrCard } from '../ui/QrCard'

export function SupportPanel({ go }: { go: Navigate }) {
  return (
    <section className="page support-layout">
      <div className="support-copy">
        <span className="eyebrow">
          <Heart size={16} fill="currentColor" /> 公益 & 学生友好
        </span>
        <h2>赞助一下，让这个工具继续免费</h2>
        <p>
          简历发电站会尽量长期免费提供给大学生使用。AI 模型和服务器有成本，如果这个工具帮到了你，欢迎自愿赞助一杯咖啡。
        </p>
        <div className="promise">不赞助也完全不影响使用，每天仍可免费优化 3 次。</div>
        <button className="button button--primary" onClick={() => notify('比起赞助，我们更希望你能分享这个工具。感谢支持！')} type="button">
          <Zap size={18} fill="currentColor" /> 去爱发电支持
        </button>
      </div>
      <QrCard image="can1" title="微信收款码" />
      <QrCard image="can2" title="支付宝收款码" />
      <button className="button button--ghost support-back" onClick={() => go('optimizer')} type="button">
        返回继续免费优化
      </button>
    </section>
  )
}
