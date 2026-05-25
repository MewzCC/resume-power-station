export type Page =
  | 'home'
  | 'login'
  | 'register'
  | 'optimizer'
  | 'result'
  | 'edit'
  | 'support'
  | 'dashboard-resumes'
  | 'dashboard-history'
  | 'admin'
  | 'forbidden'
  | 'not-found'

export type RouteState = {
  page: Page
  path: string
  params: Record<string, string>
}

export type NavigateOptions = {
  replace?: boolean
  params?: Record<string, string>
}

export type Navigate = (target: Page | string, options?: NavigateOptions) => void
