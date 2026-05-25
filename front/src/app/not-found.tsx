import { Compass, Home, RotateCcw } from 'lucide-react'
import type { Navigate } from '../types/navigation'

type NotFoundPageProps = {
  go: Navigate
  path: string
}

export function NotFoundPage({ go, path }: NotFoundPageProps) {
  return (
    <section className="page route-state-page">
      <div className="route-state-card">
        <span className="route-state-icon">
          <Compass size={34} />
        </span>
        <div>
          <span className="eyebrow">404</span>
          <h1>页面不存在</h1>
          <p>没有找到路径：{path}。可能是链接拼错了，或者这个页面还没有开放。</p>
        </div>
        <div className="route-actions">
          <button className="button button--primary" onClick={() => go('home')} type="button">
            <Home size={18} /> 返回首页
          </button>
          <button className="button button--ghost" onClick={() => go('optimizer')} type="button">
            <RotateCcw size={18} /> 去免费优化
          </button>
        </div>
      </div>
    </section>
  )
}

export default NotFoundPage
