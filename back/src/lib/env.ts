import 'dotenv/config'

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

export const env = {
  port: numberEnv('PORT', 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  openAiApiKey: process.env.OPENAI_API_KEY ?? '',
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  analysisModel: process.env.OPENAI_MODEL_ANALYSIS ?? 'gpt-4.1-mini',
  optimizeModel: process.env.OPENAI_MODEL_OPTIMIZE ?? 'gpt-4.1',
  fastOptimizeModel: process.env.OPENAI_MODEL_FAST_OPTIMIZE ?? process.env.OPENAI_MODEL_ANALYSIS ?? 'gpt-4.1-mini',
  aiFastMode: process.env.AI_FAST_MODE !== 'false',
  aiRequestTimeoutMs: numberEnv('AI_REQUEST_TIMEOUT_MS', 300000),
  aiMaxResumeChars: numberEnv('AI_MAX_RESUME_CHARS', 12000),
  aiMaxJdChars: numberEnv('AI_MAX_JD_CHARS', 5000),
  aiMaxOutputTokens: numberEnv('AI_MAX_OUTPUT_TOKENS', 0),
  mockAi: process.env.MOCK_AI === 'true' || !process.env.OPENAI_API_KEY,
  uploadMaxSizeMb: numberEnv('UPLOAD_MAX_SIZE_MB', 10),
  dailyOptimizeLimit: numberEnv('DAILY_OPTIMIZE_LIMIT', 3),
  afdianUrl: process.env.AFDIAN_URL ?? 'https://afdian.com/a/yourname',
  enablePdfExport: process.env.ENABLE_PDF_EXPORT !== 'false',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: numberEnv('SMTP_PORT', 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'no-reply@resume-power-station.local',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
  emailCodeExpiresSeconds: numberEnv('EMAIL_CODE_EXPIRES_SECONDS', 300),
  emailCodeResendSeconds: numberEnv('EMAIL_CODE_RESEND_SECONDS', 60),
  emailCodeMaxAttempts: numberEnv('EMAIL_CODE_MAX_ATTEMPTS', 5),
  emailCodeMaxPerEmailHour: numberEnv('EMAIL_CODE_MAX_PER_EMAIL_HOUR', 10),
  emailCodeMaxPerIpHour: numberEnv('EMAIL_CODE_MAX_PER_IP_HOUR', 30),
}
