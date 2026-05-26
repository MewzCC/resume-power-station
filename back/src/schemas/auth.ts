import { z } from 'zod'

const emailSchema = z.string().trim().toLowerCase().email('邮箱格式不正确').max(255)
const passwordSchema = z.string().min(8, '密码至少 8 位').max(128, '密码不能超过 128 位')
const codeSchema = z.string().trim().regex(/^\d{6}$/, '请输入 6 位邮箱验证码')

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, '昵称不能为空').max(60, '昵称不能超过 60 个字符').optional(),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '请输入密码').max(128, '密码不能超过 128 位'),
})

export const sendEmailCodeSchema = z.object({
  email: emailSchema,
  scene: z.enum(['login', 'register', 'resetPassword']),
})

export const emailCodeLoginSchema = z.object({
  email: emailSchema,
  code: codeSchema,
})

export const emailCodeRegisterSchema = emailCodeLoginSchema.extend({
  password: passwordSchema,
  name: z.string().trim().min(1, '昵称不能为空').max(60, '昵称不能超过 60 个字符').optional(),
})

export const resetPasswordSchema = emailCodeLoginSchema.extend({
  password: passwordSchema,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SendEmailCodeInput = z.infer<typeof sendEmailCodeSchema>
export type EmailCodeLoginInput = z.infer<typeof emailCodeLoginSchema>
export type EmailCodeRegisterInput = z.infer<typeof emailCodeRegisterSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
