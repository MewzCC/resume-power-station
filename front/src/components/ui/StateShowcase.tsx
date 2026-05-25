import {
  BatteryWarning,
  ClipboardList,
  FileText,
  Languages,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import type { Navigate } from '../../types/navigation'

export function StateShowcase({ go }: { go: Navigate }) {
  return (
    <section className="state-showcase" aria-label="常见状态与反馈组件示例">
      <article>
        <BatteryWarning size={42} />
        <h3>次数用完</h3>
        <p>今天的 3 次免费优化已经用完，明天可以继续使用。</p>
        <button type="button" onClick={() => go('support')}>赞助一下</button>
      </article>
      <article>
        <ClipboardList size={42} />
        <h3>空状态</h3>
        <p>还没有优化记录。上传你的第一份简历，让 AI 帮你看看。</p>
        <button type="button" onClick={() => go('optimizer')}>去上传简历</button>
      </article>
      <article className="state-error">
        <FileText size={42} />
        <h3>文件解析失败</h3>
        <p>请检查文件是否完整，或改用文本粘贴。</p>
        <button type="button"><RotateCcw size={15} />重新上传</button>
      </article>
      <article className="loading-card">
        <Loader2 size={28} />
        <h3>Loading 状态</h3>
        <p>正在读取简历内容、分析目标岗位、生成优化版本。</p>
      </article>
      <article>
        <Languages size={42} />
        <h3>中英输出</h3>
        <p>可按投递场景选择中文或英文版本。</p>
      </article>
    </section>
  )
}
