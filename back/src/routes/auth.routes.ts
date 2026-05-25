import type { FastifyInstance } from 'fastify'
import {
  emailCodeLoginController,
  emailCodeRegisterController,
  loginController,
  logoutController,
  meController,
  resetPasswordController,
  sendEmailCodeController,
} from '../controllers/auth.controller.js'

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/email-code/send', sendEmailCodeController)
  app.post('/api/auth/register/email-code', emailCodeRegisterController)
  app.post('/api/auth/login/email-code', emailCodeLoginController)
  app.post('/api/auth/password/reset', resetPasswordController)
  app.post('/api/auth/login', loginController)
  app.get('/api/auth/me', meController)
  app.post('/api/auth/logout', logoutController)
}
