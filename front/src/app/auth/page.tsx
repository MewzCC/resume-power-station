import { AuthPanel } from '../../components/auth/AuthPanel'
import type { EmailCodeScene, SendEmailCodeResult } from '../../types/api'
import type { Navigate, Page } from '../../types/navigation'

type AuthPageProps = {
  login: (input: { email: string; code: string }) => Promise<void>
  loginWithPassword: (input: { email: string; password: string }) => Promise<void>
  mode: Extract<Page, 'login' | 'register'>
  recoverPassword: (input: { email: string; code: string; password: string }) => Promise<{ reset: boolean }>
  register: (input: { email: string; code: string; password: string; name?: string }) => Promise<void>
  requestEmailCode: (input: { email: string; scene: EmailCodeScene }) => Promise<SendEmailCodeResult>
  go: Navigate
}

export function AuthPage(props: AuthPageProps) {
  return <AuthPanel {...props} />
}

export default AuthPage
