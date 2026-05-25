import { useCallback, useEffect, useState } from 'react'
import {
  ApiRequestError,
  getCurrentUser,
  getTodayUsage,
  loginAccount,
  loginWithEmailCode,
  logoutAccount,
  registerWithEmailCode,
  resetPassword,
  sendEmailCode,
} from '../lib/api'
import { notifyError } from '../lib/error-events'
import type { EmailCodeScene, TodayUsage, User } from '../types/api'

type AuthStatus = 'checking' | 'authenticated' | 'guest'

export function useAuthStore() {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<User | null>(null)
  const [usage, setUsage] = useState<TodayUsage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshUsage = useCallback(async () => {
    try {
      const nextUsage = await getTodayUsage()
      setUsage(nextUsage)
      return nextUsage
    } catch (requestError) {
      setUsage(null)
      if (requestError instanceof ApiRequestError) {
        notifyError(`登录成功，但次数同步失败：${requestError.message}`)
      }
      return null
    }
  }, [])

  const refreshSession = useCallback(async () => {
    setStatus('checking')
    setError(null)

    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      setStatus('authenticated')
      await refreshUsage()
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code !== 'UNAUTHENTICATED') {
        setError(requestError.message)
      }
      setUser(null)
      setUsage(null)
      setStatus('guest')
    }
  }, [refreshUsage])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshSession()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [refreshSession])

  function requestEmailCode(input: { email: string; scene: EmailCodeScene }) {
    setError(null)
    return sendEmailCode(input)
  }

  async function login(input: { email: string; code: string }) {
    setError(null)
    const session = await loginWithEmailCode(input)
    setUser(session.user)
    setStatus('authenticated')
    await refreshUsage()
  }

  async function loginWithPassword(input: { email: string; password: string }) {
    setError(null)
    const session = await loginAccount(input)
    setUser(session.user)
    setStatus('authenticated')
    await refreshUsage()
  }

  async function register(input: { email: string; code: string; password: string; name?: string }) {
    setError(null)
    const session = await registerWithEmailCode(input)
    setUser(session.user)
    setStatus('authenticated')
    await refreshUsage()
  }

  function recoverPassword(input: { email: string; code: string; password: string }) {
    setError(null)
    return resetPassword(input)
  }

  async function logout() {
    setError(null)
    await logoutAccount()
    setUser(null)
    setUsage(null)
    setStatus('guest')
  }

  return {
    error,
    isAuthenticated: status === 'authenticated',
    isCheckingAuth: status === 'checking',
    login,
    loginWithPassword,
    logout,
    recoverPassword,
    requestEmailCode,
    refreshSession,
    refreshUsage,
    register,
    status,
    usage,
    setUsage,
    user,
  }
}
