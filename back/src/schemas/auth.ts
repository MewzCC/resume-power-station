import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(255),
  password: z.string().min(8, '密码至少 8 位').max(128, '密码不能超过 128 位'),
  name: z.string().trim().min(1).max(60).optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(255),
  password: z.string().min(1, '请输入密码').max(128),
})

export const sendEmailCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(255),
  scene: z.enum(['login', 'register', 'resetPassword']),
})

export const emailCodeLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确').max(255),
  code: z.string().trim().regex(/^\d{6}$/, '请输入 6 位邮箱验证码'),
})

export const emailCodeRegisterSchema = emailCodeLoginSchema.extend({
  password: z.string().min(8, '密码至少 8 位').max(128, '密码不能超过 128 位'),
  name: z.string().trim().min(1).max(60).optional(),
})

export const resetPasswordSchema = emailCodeLoginSchema.extend({
  password: z.string().min(8, '密码至少 8 位').max(128, '密码不能超过 128 位'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SendEmailCodeInput = z.infer<typeof sendEmailCodeSchema>
export type EmailCodeLoginInput = z.infer<typeof emailCodeLoginSchema>
export type EmailCodeRegisterInput = z.infer<typeof emailCodeRegisterSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
