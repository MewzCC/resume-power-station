import type { FastifyReply } from 'fastify'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_EXISTS'
  | 'EMAIL_NOT_REGISTERED'
  | 'EMAIL_CODE_INVALID'
  | 'EMAIL_CODE_EXPIRED'
  | 'EMAIL_CODE_TOO_FREQUENT'
  | 'EMAIL_CODE_SEND_FAILED'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'PARSE_FAILED'
  | 'AI_FAILED'
  | 'AI_JSON_INVALID'
  | 'NOT_FOUND'
  | 'PDF_EXPORT_UNAVAILABLE'
  | 'REQUEST_TIMEOUT'
  | 'INTERNAL_ERROR'

export function ok<T>(data: T) {
  return {
    success: true,
    data,
  }
}

export function fail(code: ErrorCode, message: string, details?: unknown) {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  }
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
) {
  return reply.status(statusCode).send(fail(code, message, details))
}
