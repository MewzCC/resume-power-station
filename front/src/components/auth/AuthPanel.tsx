import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Hash, LockKeyhole, Mail, Send, ShieldCheck, UserRound, Zap } from 'lucide-react'
import { ApiRequestError } from '../../lib/api'
import { notifySuccess } from '../../lib/error-events'
import type { EmailCodeScene, SendEmailCodeResult } from '../../types/api'
import type { Navigate, Page } from '../../types/navigation'

type AuthMode = Extract<Page, 'login' | 'register'>
type LoginMethod = 'password' | 'code' | 'forgot'

type AuthPanelProps = {
  mode: AuthMode
  login: (input: { email: string; code: string }) => Promise<void>
  loginWithPassword: (input: { email: string; password: string }) => Promise<void>
  recoverPassword: (input: { email: string; code: string; password: string }) => Promise<{ reset: boolean }>
  register: (input: { email: string; code: string; password: string; name?: string }) => Promise<void>
  requestEmailCode: (input: { email: string; scene: EmailCodeScene }) => Promise<SendEmailCodeResult>
  go: Navigate
}

export function AuthPanel({
  go,
  login,
  loginWithPassword,
  mode,
  recoverPassword,
  register,
  requestEmailCode,
}: AuthPanelProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password')
  const [cooldown, setCooldown] = useState(0)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isRegister = mode === 'register'
  const needsCode = isRegister || loginMethod === 'code' || loginMethod === 'forgot'

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setError(null)
      setCode('')
      setCooldown(0)
      setPassword('')
      setConfirmPassword('')
      setLoginMethod('password')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [mode])

  useEffect(() => {
    if (cooldown <= 0) return undefined

    const timer = window.setTimeout(() => {
      setCooldown((current) => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [cooldown])

  function codeScene(): EmailCodeScene {
    if (isRegister) return 'register'
    if (loginMethod === 'forgot') return 'resetPassword'
    return 'login'
  }

  async function handleSendCode() {
    setError(null)

    if (!email.trim()) {
      setError('请先输入邮箱。')
      return
    }

    setIsSendingCode(true)
    try {
      const result = await requestEmailCode({
        email,
        scene: codeScene(),
      })
      setCooldown(result.resendAfter)
      notifySuccess(result.devCode ? `验证码已生成：${result.devCode}` : '验证码已发送，请查看邮箱。')
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : '验证码发送失败，请稍后重试。')
    } finally {
      setIsSendingCode(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if ((isRegister || loginMethod === 'forgot') && password.length < 8) {
      setError('密码至少需要 8 位。')
      return
    }

    if ((isRegister || loginMethod === 'forgot') && password !== confirmPassword) {
      setError('两次输入的密码不一致。')
      return
    }

    if (needsCode && !/^\d{6}$/.test(code.trim())) {
      setError('请输入 6 位邮箱验证码。')
      return
    }

    setIsSubmitting(true)
    try {
      if (isRegister) {
        await register({ email, code, password, name: name.trim() || undefined })
        go('optimizer')
        return
      }

      if (loginMethod === 'password') {
        await loginWithPassword({ email, password })
        go('optimizer')
        return
      }

      if (loginMethod === 'forgot') {
        await recoverPassword({ email, code, password })
        notifySuccess('密码已重置，请使用新密码登录。')
        setLoginMethod('password')
        setCode('')
        setPassword('')
        setConfirmPassword('')
        return
      }

      await login({ email, code })
      go('optimizer')
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : '登录服务暂时不可用，请稍后重试。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = isRegister
    ? '注册后开始使用'
    : loginMethod === 'forgot'
      ? '找回密码'
      : '欢迎登录'
  const submitText = isSubmitting
    ? '正在处理...'
    : isRegister
      ? '注册并同步次数'
      : loginMethod === 'forgot'
        ? '重置密码'
        : '登录并同步次数'

  return (
    <section className="page auth-page">
      <motion.div
        className="auth-visual"
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.42, ease: 'easeOut' }}
      >
        <span className="eyebrow">
          <Zap size={16} fill="currentColor" /> 账号安全登录
        </span>
        <h1>{isRegister ? '创建免费账号' : '欢迎使用'}</h1>
        <h1>{isRegister ? '同步优化次数' : 'AI 简历优化器'}</h1>
        <p>支持密码登录、邮箱验证码登录和找回密码。后端使用 HttpOnly Cookie 维护会话，前端只负责发起请求和展示状态。</p>
        <div className="auth-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </motion.div>

      <motion.form
        className="auth-card"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.38, ease: 'easeOut', delay: 0.08 }}
      >
        <div>
          <span className="eyebrow">
            <ShieldCheck size={16} /> {isRegister ? '注册' : loginMethod === 'forgot' ? '找回密码' : '登录'}
          </span>
          <h2>{title}</h2>
        </div>

        {!isRegister && (
          <div className="auth-methods" role="tablist" aria-label="登录方式">
            <button
              className={loginMethod === 'password' ? 'is-selected' : ''}
              onClick={() => setLoginMethod('password')}
              type="button"
            >
              密码登录
            </button>
            <button
              className={loginMethod === 'code' ? 'is-selected' : ''}
              onClick={() => setLoginMethod('code')}
              type="button"
            >
              验证码登录
            </button>
          </div>
        )}

        {isRegister && (
          <label className="field auth-field">
            <span>昵称（可选）</span>
            <div>
              <UserRound size={18} />
              <input
                autoComplete="name"
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                placeholder="例：张同学"
                value={name}
              />
            </div>
          </label>
        )}

        <label className="field auth-field">
          <span>邮箱</span>
          <div>
            <Mail size={18} />
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@example.com"
              required
              type="email"
              value={email}
            />
          </div>
        </label>

        {(isRegister || loginMethod === 'password' || loginMethod === 'forgot') && (
          <label className="field auth-field">
            <span>{loginMethod === 'forgot' ? '新密码' : '密码'}</span>
            <div>
              <LockKeyhole size={18} />
              <input
                autoComplete={isRegister || loginMethod === 'forgot' ? 'new-password' : 'current-password'}
                maxLength={128}
                minLength={isRegister || loginMethod === 'forgot' ? 8 : 1}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegister || loginMethod === 'forgot' ? '至少 8 位' : '输入密码'}
                required
                type="password"
                value={password}
              />
            </div>
          </label>
        )}

        {(isRegister || loginMethod === 'forgot') && (
          <label className="field auth-field">
            <span>确认密码</span>
            <div>
              <LockKeyhole size={18} />
              <input
                autoComplete="new-password"
                maxLength={128}
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="再次输入密码"
                required
                type="password"
                value={confirmPassword}
              />
            </div>
          </label>
        )}

        {needsCode && (
          <label className="field auth-field">
            <span>邮箱验证码</span>
            <div className="auth-code-control">
              <Hash size={18} />
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="输入 6 位验证码"
                required
                value={code}
              />
              <button
                className="auth-code-button"
                disabled={isSendingCode || cooldown > 0}
                onClick={handleSendCode}
                type="button"
              >
                <Send size={15} />
                {cooldown > 0 ? `${cooldown}s` : isSendingCode ? '发送中' : '获取验证码'}
              </button>
            </div>
          </label>
        )}

        {error && <p className="form-feedback">{error}</p>}

        <button className="button button--primary submit-button" disabled={isSubmitting} type="submit">
          {submitText}
        </button>

        {!isRegister && (
          <div className="auth-link-row">
            <button
              className="auth-switch"
              onClick={() => setLoginMethod(loginMethod === 'forgot' ? 'password' : 'forgot')}
              type="button"
            >
              {loginMethod === 'forgot' ? '返回登录' : '忘记密码？'}
            </button>
          </div>
        )}

        <button
          className="auth-switch"
          onClick={() => go(isRegister ? 'login' : 'register')}
          type="button"
        >
          {isRegister ? '已有账号？去登录' : '还没有账号？免费注册'}
        </button>
      </motion.form>
    </section>
  )
}
