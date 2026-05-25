import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Clock3, FileText, History, LogOut, Settings, UserRound, XCircle, Zap } from 'lucide-react'
import { navItems } from '../../lib/constants'
import { notify } from '../../lib/error-events'
import type { OptimizeStreamEvent, TodayUsage, User } from '../../types/api'
import type { Navigate, Page } from '../../types/navigation'
import { GlobalToast } from '../ui/GlobalToast'
import { QuotaCard } from '../ui/QuotaCard'

type AppLayoutProps = {
  children: ReactNode
  isAuthenticated: boolean
  isCheckingAuth: boolean
  logout: () => Promise<void>
  page: Page
  pageTitle: string
  usage: TodayUsage | null
  user: User | null
  analysisStartedAt?: number | null
  cancelAnalysis?: () => void
  isAnalyzing?: boolean
  serverStage?: OptimizeStreamEvent | null
  go: Navigate
}

export function AppLayout({
  children,
  go,
  isAuthenticated,
  isCheckingAuth,
  logout,
  page,
  pageTitle,
  usage,
  user,
  analysisStartedAt,
  cancelAnalysis,
  isAnalyzing,
  serverStage,
}: AppLayoutProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isUserMenuOpen) return undefined

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsUserMenuOpen(false)
    }

    window.addEventListener('mousedown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.removeEventListener('mousedown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isUserMenuOpen])

  useEffect(() => {
    if (!isAnalyzing || analysisStartedAt === null || analysisStartedAt === undefined) return undefined

    const updateElapsed = () => {
      setAnalysisElapsedSeconds(Math.floor((Date.now() - analysisStartedAt) / 1000))
    }
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)

    return () => window.clearInterval(timer)
  }, [analysisStartedAt, isAnalyzing])

  function closeUserMenuAndGo(target: Page) {
    setIsUserMenuOpen(false)
    go(target)
  }

  function formatElapsed(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes}:${rest.toString().padStart(2, '0')}`
  }

  return (
    <div className="app-shell">
      <GlobalToast />
      <header className="topbar">
        <button className="brand" onClick={() => go('home')} type="button">
          <span className="brand__bolt">
            <Zap size={26} fill="currentColor" />
          </span>
          <span>
            <strong>简历发电站</strong>
            <small>给你的简历充点电。</small>
          </span>
        </button>
        <nav aria-label="主导航">
          {navItems.map((item) => (
            <button
              className={page === item.id ? 'nav-pill nav-pill--active' : 'nav-pill'}
              key={item.id}
              onClick={() => go(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <QuotaCard
            compact
            isAuthenticated={isAuthenticated}
            isLoading={isCheckingAuth}
            usage={usage}
          />
          {isAuthenticated ? (
            <div className="user-menu" ref={userMenuRef}>
              <button
                className={`user-chip ${isUserMenuOpen ? 'is-open' : ''}`}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsUserMenuOpen((open) => !open)}
                type="button"
              >
                <UserRound size={16} />
                <span>{user?.name || user?.email}</span>
                <ChevronDown size={15} />
              </button>

              {isUserMenuOpen && (
                <div className="user-dropdown" role="menu">
                  <button onClick={() => closeUserMenuAndGo('dashboard-resumes')} role="menuitem" type="button">
                    <FileText size={16} />
                    <span>
                      我的简历
                      <small>查看上传过的简历</small>
                    </span>
                  </button>
                  <button onClick={() => closeUserMenuAndGo('dashboard-history')} role="menuitem" type="button">
                    <History size={16} />
                    <span>
                      优化历史
                      <small>查看之前的数据</small>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      notify('账号设置入口未开发待后续接入。')
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <Settings size={16} />
                    <span>
                      账号设置
                      <small>资料与安全设置</small>
                    </span>
                  </button>
                  <button
                    className="user-dropdown__danger"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      void logout()
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <LogOut size={16} />
                    <span>
                      退出登录
                      <small>结束当前会话</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-actions">
              <button className="nav-pill" onClick={() => go('login')} type="button">
                登录
              </button>
              <button className="button button--primary button--small" onClick={() => go('register')} type="button">
                注册
              </button>
            </div>
          )}
        </div>
      </header>

      {isAuthenticated && isAnalyzing && page !== 'optimizer' && (
        <div className="analysis-persistent-bar" role="status" aria-live="polite">
          <span className="analysis-live-dot" aria-hidden="true" />
          <div>
            <strong>{serverStage?.message ?? 'AI 分析仍在后台进行中'}</strong>
            <small>切换页面不会中断任务，完成后会自动进入结果页。</small>
          </div>
          <span className="analysis-persistent-time">
            <Clock3 size={15} />
            {formatElapsed(analysisElapsedSeconds)}
          </span>
          <button className="button button--ghost button--small" onClick={() => go('optimizer')} type="button">
            返回查看
          </button>
          <button className="analysis-persistent-cancel" onClick={cancelAnalysis} type="button" aria-label="取消分析">
            <XCircle size={18} />
          </button>
        </div>
      )}

      <main>
        <div className="mobile-title">
          <span>{pageTitle}</span>
          <QuotaCard compact isAuthenticated={isAuthenticated} isLoading={isCheckingAuth} usage={usage} />
        </div>
        {children}
      </main>
    </div>
  )
}
