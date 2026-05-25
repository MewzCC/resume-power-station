export const RESUME_MIN_LENGTH = 200

export function validateOptimizerForm(resumeText: string, targetJob: string) {
  return {
    resumeTooShort: resumeText.length > 0 && resumeText.length < RESUME_MIN_LENGTH,
    canSubmit: resumeText.length >= RESUME_MIN_LENGTH && targetJob.trim().length > 0,
  }
}
