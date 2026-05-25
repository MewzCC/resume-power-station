import { LockKeyhole, LogIn, ShieldCheck } from 'lucide-react'
import type { Navigate } from '../../types/navigation'

type ForbiddenPageProps = {
  go: Navigate
  isCheckingAuth?: boolean
}

export function ForbiddenPage({ go, isCheckingAuth = false }: ForbiddenPageProps) {
  return (
    <section className="page route-state-page">
      <div className="route-state-card route-state-card--auth">
        <span className="route-state-icon">
          {isCheckingAuth ? <ShieldCheck size={34} /> : <LockKeyhole size={34} />}
        </span>
        <div>
          <span className="eyebrow">权限验证</span>
          <h1>{isCheckingAuth ? '正在校验登录状态' : '请先登录后继续'}</h1>
          <p>
            {isCheckingAuth
              ? '系统正在读取当前会话和今日免费次数，稍等一下就好。'
              : '该页面需要登录后访问。登录成功后，今日免费次数、分析结果和导出权限会按账号同步。'}
          </p>
        </div>
        {!isCheckingAuth && (
          <div className="route-actions">
            <button className="button button--primary" onClick={() => go('login')} type="button">
              <LogIn size={18} /> 去登录
            </button>
            <button className="button button--ghost" onClick={() => go('register')} type="button">
              免费注册
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default ForbiddenPage
