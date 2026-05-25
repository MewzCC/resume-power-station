import { CheckCircle2 } from 'lucide-react'

export function InfoNote() {
  return (
    <article className="info-note">
      <CheckCircle2 size={20} />
      <div>
        <strong>没有粘贴岗位 JD 也可以分析</strong>
        <p>但目标岗位越清楚，结果越贴近真实投递。</p>
      </div>
    </article>
  )
}
