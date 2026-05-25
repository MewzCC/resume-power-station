const privateIconRange = /[\uE000-\uF8FF]/g
const pageMarkerPattern = /^\s*(?:[-–—]{1,2}\s*)?\d+\s+of\s+\d+\s*(?:[-–—]{1,2})?\s*$/i
const knownSectionTitles = new Set([
  '基本信息',
  '求职意向',
  '专业技能',
  '技能清单',
  '实习经历',
  '工作经历',
  '项目经历',
  '教育背景',
  '教育经历',
  '奖项证书',
  '证书奖项',
  '获得奖项',
  '校园经历',
  '自我评价',
])
const nameRejectWords = new Set(['开发', '架构', '实践', '项目', '系统', '平台', '服务', '模块', '功能', '数据'])

function normalizeChars(text: string) {
  return text
    .normalize('NFKC')
    .replace(privateIconRange, '·')
    .replace(/[\u2022\u25CF\u25C6\u25AA\u25A0]\uFE0E?/g, '·')
    .replace(/\u00A0/g, ' ')
    .replace(/\r/g, '\n')
}

function compactLine(line: string) {
  return line.trim().replace(/[\t ]+/g, ' ')
}

function plainTitle(line: string) {
  return line.replace(/[【】\s]/g, '')
}

function isKnownSectionTitle(line: string) {
  return knownSectionTitles.has(plainTitle(line))
}

function isLikelyName(line: string) {
  const normalized = line.replace(/\s+/g, '')
  return /^[\u4e00-\u9fa5]{2,4}$/.test(normalized)
    && !knownSectionTitles.has(normalized)
    && !nameRejectWords.has(normalized)
}

function isNumberedSkill(line: string) {
  return /^\d+[.)、．]\s*/.test(line)
}

function shouldJoin(previous: string, current: string) {
  if (!previous || !current) return false
  if (isKnownSectionTitle(previous) || isKnownSectionTitle(current)) return false
  if (isLikelyName(current)) return false
  if (isNumberedSkill(current)) return false
  if (/^[·\-*]/.test(current)) return false
  if (/^(项目|主要工作|Git\s*链接|电话|邮箱|求职意向)[:：]/i.test(current)) return false
  if (looksLikeProjectHeader(current) || looksLikeEducationLine(current) || /^获得奖项[:：]/.test(current)) return false
  if (/^[\u4e00-\u9fa5]{2,20}\s+.+\d{4}[-~～]/.test(current)) return false
  if (/。|；|;|！|!|？|\?|：|:$/.test(previous)) return false

  return current.length <= 16 || /[，、,（(]|与|和|及|等|实$|架$|算$|导$/.test(previous)
}

function compactLines(rawText: string) {
  const output: string[] = []
  const lines = normalizeChars(rawText).split('\n')

  for (const rawLine of lines) {
    const line = compactLine(rawLine)
    if (!line || pageMarkerPattern.test(line)) continue

    const previous = output.at(-1)
    if (previous && shouldJoin(previous, line)) {
      output[output.length - 1] = `${previous}${line}`
      continue
    }
    output.push(line)
  }

  return output
}

function uniquePush(output: string[], line: string) {
  const previous = output.at(-1)
  if (previous === line) return
  output.push(line)
}

function pushSection(output: string[], title: string) {
  if (output.length && output.at(-1) !== '') output.push('')
  uniquePush(output, `【${title}】`)
}

function hasSection(output: string[], title: string) {
  return output.includes(`【${title}】`)
}

function looksLikeEducationLine(line: string) {
  return /学院|大学|学校/.test(line) && /本科|专科|硕士|博士|网络工程|软件工程|计算机/.test(line) && /\d{4}/.test(line)
}

function looksLikeProjectHeader(line: string) {
  return /比赛项目|项目\)/.test(line) || (/平台|系统/.test(line) && /\d{4}[-~～]/.test(line) && !/有限公司/.test(line))
}

function extractLeadingSkills(lines: string[]) {
  const nameIndex = lines.findIndex((line, index) => {
    if (!isLikelyName(line)) return false
    return lines.slice(index + 1, index + 6).some((nextLine) => /^求职意向[:：]/.test(nextLine))
  })
  if (nameIndex <= 0) {
    return { nameIndex, skills: [] as string[] }
  }

  const leading = lines.slice(0, nameIndex)
  const numberedCount = leading.filter((line) => isNumberedSkill(line)).length
  return {
    nameIndex,
    skills: numberedCount >= 3 ? leading : [],
  }
}

function normalizeChineseResumeLayout(lines: string[]) {
  const { nameIndex, skills } = extractLeadingSkills(lines)
  if (nameIndex < 0 || skills.length === 0) {
    return lines
  }

  const afterName = lines.slice(nameIndex)
  const internshipIndex = afterName.findIndex((line) => plainTitle(line) === '实习经历')
  const beforeInternship = internshipIndex >= 0 ? afterName.slice(0, internshipIndex) : afterName
  const afterInternship = internshipIndex >= 0 ? afterName.slice(internshipIndex) : []
  const output: string[] = []

  for (const line of beforeInternship) {
    const title = plainTitle(line)
    if (title === '专业技能' || title === '技能清单') continue
    if (isKnownSectionTitle(line)) {
      pushSection(output, title)
    } else {
      uniquePush(output, line)
    }
  }

  pushSection(output, '专业技能')
  for (const skill of skills) {
    uniquePush(output, skill)
  }

  let currentSection = ''
  for (const line of afterInternship) {
    const title = plainTitle(line)
    if (title === '专业技能' || title === '技能清单') continue

    if (isKnownSectionTitle(line)) {
      if (title === '获得奖项') {
        pushSection(output, '奖项证书')
        currentSection = '奖项证书'
      } else if (title !== '教育背景' && title !== '项目经历') {
        pushSection(output, title)
        currentSection = title
      }
      continue
    }

    if (looksLikeProjectHeader(line) && currentSection !== '项目经历') {
      pushSection(output, '项目经历')
      currentSection = '项目经历'
    }

    if (looksLikeEducationLine(line) && !hasSection(output, '教育背景')) {
      pushSection(output, '教育背景')
      currentSection = '教育背景'
    }

    if (/^获得奖项[:：]/.test(line) && currentSection !== '奖项证书') {
      pushSection(output, '奖项证书')
      currentSection = '奖项证书'
    }

    uniquePush(output, line.replace(/^获得奖项[:：]\s*/, ''))
  }

  return output
}

export function normalizeParsedResumeText(rawText: string) {
  const compacted = compactLines(rawText)
  const normalized = normalizeChineseResumeLayout(compacted)

  return normalized
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
