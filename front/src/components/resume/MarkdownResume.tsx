import type { ResumeChange } from '../../types/resume'

type MarkdownResumeProps = {
  markdown: string
  changes?: ResumeChange[]
  mode: 'before' | 'after'
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightedText({ text, changes, mode }: MarkdownResumeProps & { text: string }) {
  const candidates = (changes ?? [])
    .map((change) => ({
      ...change,
      needle: mode === 'after' ? change.after : change.before,
    }))
    .filter((change) => change.needle?.trim())
    .sort((a, b) => (b.needle?.length ?? 0) - (a.needle?.length ?? 0))

  if (!candidates.length) return <>{text}</>

  const pattern = new RegExp(candidates.map((change) => escapeRegExp(change.needle ?? '')).join('|'), 'g')
  const parts = text.split(pattern)
  const matches = text.match(pattern) ?? []

  return (
    <>
      {parts.map((part, index) => {
        const match = matches[index]
        const change = candidates.find((item) => item.needle === match)
        return (
          <span key={`${part}-${index}`}>
            {part}
            {match && change && (
              <mark className={`resume-mark resume-mark--${change.type}`} data-change-id={change.id}>
                {match}
              </mark>
            )}
          </span>
        )
      })}
    </>
  )
}

export function MarkdownResume({ markdown, changes = [], mode }: MarkdownResumeProps) {
  const lines = markdown.split('\n')
  const blocks: Array<{ type: 'h1' | 'h2' | 'h3' | 'p' | 'li'; text: string }> = []

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    if (trimmed.startsWith('### ')) blocks.push({ type: 'h3', text: trimmed.replace(/^###\s+/, '') })
    else if (trimmed.startsWith('## ')) blocks.push({ type: 'h2', text: trimmed.replace(/^##\s+/, '') })
    else if (trimmed.startsWith('# ')) blocks.push({ type: 'h1', text: trimmed.replace(/^#\s+/, '') })
    else if (/^[-*]\s+/.test(trimmed)) blocks.push({ type: 'li', text: trimmed.replace(/^[-*]\s+/, '') })
    else blocks.push({ type: 'p', text: trimmed })
  })

  return (
    <article className="markdown-resume">
      {blocks.map((block, index) => {
        const content = <HighlightedText markdown={markdown} mode={mode} changes={changes} text={block.text} />
        if (block.type === 'h1') return <h1 key={index}>{content}</h1>
        if (block.type === 'h2') return <h2 key={index}>{content}</h2>
        if (block.type === 'h3') return <h3 key={index}>{content}</h3>
        if (block.type === 'li') return <p className="markdown-resume__item" key={index}>{content}</p>
        return <p key={index}>{content}</p>
      })}
    </article>
  )
}
