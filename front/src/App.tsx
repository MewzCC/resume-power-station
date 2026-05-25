import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { AdminPage } from './app/admin/page'
import { AuthPage } from './app/auth/page'
import { DashboardHistoryPage } from './app/dashboard/history/page'
import { DashboardResumesPage } from './app/dashboard/resumes/page'
import { ForbiddenPage } from './app/forbidden/page'
import { NotFoundPage } from './app/not-found'
import { HomePage } from './app/page'
import { OptimizerPage } from './app/optimizer/page'
import { EditPage } from './app/optimizer/edit/[id]/page'
import { ResultPage } from './app/optimizer/result/[id]/page'
import { SupportPage } from './app/support/page'
import { AppLayout } from './components/layout/AppLayout'
import { navItems } from './lib/constants'
import { isPage, pageToPath, parseRoute, protectedPages } from './lib/router'
import { useAuthStore } from './stores/auth-store'
import { useOptimizerStore } from './stores/optimizer-store'
import type { Navigate, Page, RouteState } from './types/navigation'

function currentRoute() {
  return parseRoute(window.location.pathname)
}

function App() {
  const [route, setRoute] = useState<RouteState>(() => currentRoute())
  const auth = useAuthStore()
  const optimizer = useOptimizerStore()

  useEffect(() => {
    const handlePopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const go = useCallback<Navigate>((target, options) => {
    const path = isPage(target) ? pageToPath(target, options?.params) : target
    const nextRoute = parseRoute(path)
    const method = options?.replace ? 'replaceState' : 'pushState'

    window.history[method](null, '', nextRoute.path)
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const visiblePage: Page = protectedPages.has(route.page) && !auth.isAuthenticated
    ? 'forbidden'
    : route.page

  const pageTitle = useMemo(() => {
    if (visiblePage === 'login') return '登录'
    if (visiblePage === 'register') return '注册'
    if (visiblePage === 'forbidden') return '权限验证'
    if (visiblePage === 'not-found') return '404'
    return navItems.find((item) => item.id === visiblePage)?.label ?? '首页'
  }, [visiblePage])

  const needsAuth = protectedPages.has(route.page)
  const showForbidden = needsAuth && !auth.isAuthenticated

  return (
    <AppLayout
      go={go}
      isAuthenticated={auth.isAuthenticated}
      isCheckingAuth={auth.isCheckingAuth}
      logout={auth.logout}
      page={visiblePage}
      pageTitle={pageTitle}
      usage={auth.usage}
      user={auth.user}
      analysisStartedAt={optimizer.analysisStartedAt}
      cancelAnalysis={optimizer.cancelAnalysis}
      isAnalyzing={optimizer.isAnalyzing}
      serverStage={optimizer.serverStage}
    >
      {showForbidden && <ForbiddenPage go={go} isCheckingAuth={auth.isCheckingAuth} />}

      {!showForbidden && route.page === 'home' && (
        <HomePage
          analysis={optimizer.analysisResult}
          go={go}
          isAuthenticated={auth.isAuthenticated}
          isCheckingAuth={auth.isCheckingAuth}
          usage={auth.usage}
        />
      )}
      {!showForbidden && route.page === 'login' && (
        <AuthPage
          go={go}
          login={auth.login}
          loginWithPassword={auth.loginWithPassword}
          mode="login"
          recoverPassword={auth.recoverPassword}
          register={auth.register}
          requestEmailCode={auth.requestEmailCode}
        />
      )}
      {!showForbidden && route.page === 'register' && (
        <AuthPage
          go={go}
          login={auth.login}
          loginWithPassword={auth.loginWithPassword}
          mode="register"
          recoverPassword={auth.recoverPassword}
          register={auth.register}
          requestEmailCode={auth.requestEmailCode}
        />
      )}
      {!showForbidden && route.page === 'optimizer' && (
        <OptimizerPage
          {...optimizer}
          go={go}
          isAuthenticated={auth.isAuthenticated}
          setUsage={auth.setUsage}
          usage={auth.usage}
        />
      )}
      {!showForbidden && route.page === 'result' && <ResultPage analysis={optimizer.analysisResult} go={go} />}
      {!showForbidden && route.page === 'edit' && (
        <EditPage
          go={go}
          optimizedResume={optimizer.optimizedResume}
          resumeId={optimizer.analysisResult?.resumeId ?? route.params.id}
          versionId={optimizer.analysisResult?.versionId ?? route.params.id}
        />
      )}
      {!showForbidden && route.page === 'support' && <SupportPage go={go} />}
      {!showForbidden && route.page === 'dashboard-resumes' && <DashboardResumesPage />}
      {!showForbidden && route.page === 'dashboard-history' && (
        <DashboardHistoryPage
          go={go}
          setAnalyzeResult={optimizer.setAnalyzeResult}
          setJobDescription={optimizer.setJobDescription}
          setJobStage={optimizer.setJobStage}
          setOptimizeLevel={optimizer.setOptimizeLevel}
          setOriginalName={optimizer.setOriginalName}
          setOutputLanguage={optimizer.setOutputLanguage}
          setResumeText={optimizer.setResumeText}
          setSourceResumeId={optimizer.setSourceResumeId}
          setTargetJob={optimizer.setTargetJob}
        />
      )}
      {!showForbidden && route.page === 'admin' && <AdminPage />}
      {!showForbidden && route.page === 'forbidden' && <ForbiddenPage go={go} />}
      {!showForbidden && route.page === 'not-found' && <NotFoundPage go={go} path={route.path} />}
    </AppLayout>
  )
}

export default App
