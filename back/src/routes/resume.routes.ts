import type { FastifyInstance } from 'fastify'
import { downloadFileController } from '../controllers/download.controller.js'
import {
  archiveHistoryController,
  getHistoryDetailController,
  listHistoryController,
  restoreHistoryController,
  unarchiveHistoryController,
} from '../controllers/history.controller.js'
import { analyzeResumeController } from '../controllers/resume-analyze.controller.js'
import { optimizeResumeStreamController } from '../controllers/resume-stream.controller.js'
import {
  createResumeController,
  exportResumeDocxUrlController,
  exportResumePdfUrlController,
  getResumeDiffController,
  listResumeHistoryController,
  listResumesController,
  optimizeResumeController,
  saveResumeVersionController,
} from '../controllers/resume-contract.controller.js'
import { exportPdfController } from '../controllers/resume-export.controller.js'
import {
  getMarkdownController,
  updateMarkdownController,
} from '../controllers/resume-markdown.controller.js'
import { parseResumeController } from '../controllers/resume-parse.controller.js'
import {
  getAnalysisController,
  getVersionController,
} from '../controllers/resume-query.controller.js'

export async function resumeRoutes(app: FastifyInstance) {
  app.get('/downloads/:filename', downloadFileController)

  app.get('/api/history/resume-versions', listHistoryController)
  app.get('/api/history/resume-versions/:historyId', getHistoryDetailController)
  app.post('/api/history/resume-versions/:historyId/restore', restoreHistoryController)
  app.delete('/api/history/resume-versions/:historyId', archiveHistoryController)
  app.post('/api/history/resume-versions/:historyId/unarchive', unarchiveHistoryController)

  app.get('/api/resumes/history', listResumeHistoryController)
  app.get('/api/resumes', listResumesController)
  app.post('/api/resumes', createResumeController)
  app.post('/api/resumes/parse', parseResumeController)
  app.post('/api/resumes/analyze', analyzeResumeController)
  app.post('/api/resumes/:id/optimize/stream', optimizeResumeStreamController)
  app.post('/api/resumes/:id/optimize', optimizeResumeController)
  app.get('/api/resumes/:resumeId/versions/:versionId/diff', getResumeDiffController)
  app.put('/api/resumes/versions/:versionId', saveResumeVersionController)
  app.post('/api/resumes/:id/export/docx', exportResumeDocxUrlController)
  app.post('/api/resumes/:id/export/pdf', exportResumePdfUrlController)

  app.get('/api/resumes/analysis/:id', getAnalysisController)
  app.get('/api/resumes/version/:id', getVersionController)
  app.get('/api/resumes/version/:id/markdown', getMarkdownController)
  app.put('/api/resumes/version/:id/markdown', updateMarkdownController)
  app.post('/api/resumes/version/:id/export/pdf', exportPdfController)
}
