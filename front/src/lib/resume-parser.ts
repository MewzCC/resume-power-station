const PRIVATE_ICON_RANGE = /[\uE000-\uF8FF]/g
const PAGE_MARKER_PATTERN = /^\s*(?:[-–—]{1,2}\s*)?\d+\s+of\s+\d+\s*(?:[-–—]{1,2})?\s*$/i
const SECTION_TITLES = [
  '基本信息',
  '求职意向',
  '教育经历',
  '工作经历',
  '实习经历',
  '项目经历',
  '专业技能',
  '技能清单',
  '证书奖项',
  '校园经历',
  '自我评价',
  '个人总结',
]

const SECTION_TITLE_SET = new Set(SECTION_TITLES)

function normalizeChars(value: string) {
  return value
    .normalize('NFKC')
    .replace(PRIVATE_ICON_RANGE, ' ')
    .replace(/[\u2022\u25CF\u25C6\u25AA\u25A0]\uFE0E?/g, '·')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u3000\t]+/g, ' ')
    .replace(/([\u4E00-\u9FFF])\s+([\u4E00-\u9FFF])/g, '$1$2')
    .replace(/\u00A0/g, ' ')
    .replace(/[⼀-⿕]/g, (char) => {
      const map: Record<string, string> = {
        '⼴': '广',
        '⼯': '工',
        '⼝': '口',
        '⽤': '用',
        '⽬': '目',
        '⽰': '示',
        '⽣': '生',
        '⾃': '自',
        '⾄': '至',
        '⾼': '高',
        '⻓': '长',
        '⼒': '力',
        '⽅': '方',
        '⽂': '文',
        '⽇': '日',
        '⻚': '页',
      }
      return map[char] ?? char
    })
}

function isSectionTitle(line: string) {
  const normalized = line.replace(/\s+/g, '')
  return SECTION_TITLE_SET.has(normalized)
}

function shouldJoinWithPrevious(previous: string, current: string) {
  if (!previous || !current) return false
  if (/^[·\-*]/.test(current)) return false
  if (isSectionTitle(current)) return false
  if (/[:：]$/.test(previous)) return false
  if (/^\d+[.)、]/.test(current)) return false
  if (/^\d{4}[./-]\d{1,2}/.test(current)) return false
  if (/。|；|;|！|!|？|\?|：|:$/.test(previous)) return false
  return /[，、,]|等|及|与|和|或|覆盖|完整|完成|支持$/.test(previous) || current.length <= 18
}

function compactLines(lines: string[]) {
  const output: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s{2,}/g, ' ')
    if (!line || PAGE_MARKER_PATTERN.test(line)) continue

    const previous = output.at(-1)
    if (previous && shouldJoinWithPrevious(previous, line)) {
      output[output.length - 1] = `${previous}${line}`
    } else {
      output.push(line)
    }
  }

  return output
}

function formatSectionLines(lines: string[]) {
  const output: string[] = []

  for (const line of lines) {
    if (isSectionTitle(line)) {
      if (output.length && output.at(-1) !== '') output.push('')
      output.push(`【${line.replace(/\s+/g, '')}】`)
      continue
    }

    if (/^[·\-*]\s*/.test(line)) {
      output.push(line.replace(/^[·\-*]\s*/, '· '))
      continue
    }

    output.push(line)
  }

  return output
}

export function cleanResumeText(rawText: string) {
  const normalized = normalizeChars(rawText)
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

  const lines = compactLines(normalized.split('\n'))
  return formatSectionLines(lines)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function extractResumeSections(text: string) {
  const sections: Array<{ title: string; content: string }> = []
  let currentTitle = '未分组内容'
  let currentLines: string[] = []

  for (const line of text.split(/\r?\n/)) {
    const titleMatch = line.trim().match(/^【(.+)】$/)
    if (titleMatch) {
      if (currentLines.length) {
        sections.push({ title: currentTitle, content: currentLines.join('\n').trim() })
      }
      currentTitle = titleMatch[1]
      currentLines = []
      continue
    }

    if (line.trim()) currentLines.push(line)
  }

  if (currentLines.length) {
    sections.push({ title: currentTitle, content: currentLines.join('\n').trim() })
  }

  return sections.filter((section) => section.content.length > 0)
}
