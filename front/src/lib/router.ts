import type { Page, RouteState } from '../types/navigation'

const pagePaths: Partial<Record<Page, string>> = {
  home: '/',
  login: '/auth/login',
  register: '/auth/register',
  optimizer: '/optimizer',
  result: '/optimizer/result/latest',
  edit: '/optimizer/edit/latest',
  support: '/support',
  'dashboard-resumes': '/dashboard/resumes',
  'dashboard-history': '/dashboard/history',
  admin: '/admin',
  forbidden: '/403',
  'not-found': '/404',
}

export const protectedPages = new Set<Page>([
  'optimizer',
  'result',
  'edit',
  'dashboard-resumes',
  'dashboard-history',
  'admin',
])

function cleanPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function route(page: Page, path: string, params: Record<string, string> = {}): RouteState {
  return { page, path, params }
}

export function pageToPath(page: Page, params: Record<string, string> = {}) {
  if (page === 'result') return `/optimizer/result/${params.id ?? 'latest'}`
  if (page === 'edit') return `/optimizer/edit/${params.id ?? 'latest'}`
  return pagePaths[page] ?? '/'
}

export function parseRoute(pathname: string): RouteState {
  const path = cleanPath(pathname)
  const segments = path.split('/').filter(Boolean)

  if (path === '/') return route('home', path)
  if (path === '/login' || path === '/auth/login') return route('login', path)
  if (path === '/register' || path === '/auth/register') return route('register', path)
  if (path === '/optimizer') return route('optimizer', path)
  if (segments[0] === 'optimizer' && segments[1] === 'result' && segments[2]) {
    return route('result', path, { id: segments[2] })
  }
  if (segments[0] === 'optimizer' && segments[1] === 'edit' && segments[2]) {
    return route('edit', path, { id: segments[2] })
  }
  if (path === '/support') return route('support', path)
  if (path === '/dashboard/resumes') return route('dashboard-resumes', path)
  if (path === '/dashboard/history') return route('dashboard-history', path)
  if (path === '/admin') return route('admin', path)
  if (path === '/403') return route('forbidden', path)
  if (path === '/404') return route('not-found', path)

  return route('not-found', path)
}

export function isPage(value: string): value is Page {
  return Object.prototype.hasOwnProperty.call(pagePaths, value)
}
