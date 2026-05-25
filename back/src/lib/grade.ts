export type ResumeGrade = '优秀' | '良好' | '待优化'

export function gradeFromScore(score: number): ResumeGrade {
  if (score > 85) return '优秀'
  if (score > 70) return '良好'
  return '待优化'
}
