import { z } from 'zod'

export const historyListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().max(100).optional(),
  targetRole: z.string().trim().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  includeArchived: z.coerce.boolean().default(false),
})

export const historyRestoreSchema = z.object({
  restoreMode: z.enum(['newVersion', 'newResume']).default('newVersion'),
  versionName: z.string().trim().min(1).max(100).optional(),
})

export type HistoryListQuery = z.infer<typeof historyListQuerySchema>
export type HistoryRestoreInput = z.infer<typeof historyRestoreSchema>
