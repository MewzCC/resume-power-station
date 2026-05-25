import fs from 'node:fs/promises'
import path from 'node:path'

export const RESUME_OPTIMIZER_SKILL_NAME = 'resume-optimizer'
export const RESUME_OPTIMIZER_SKILL_VERSION = 'free_v1'

export async function loadResumeOptimizerSkill() {
  const file = path.join(process.cwd(), 'skills', 'resume-optimizer', 'skill.md')
  return fs.readFile(file, 'utf8')
}
