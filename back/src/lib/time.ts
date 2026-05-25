const timeZone = 'Asia/Shanghai'

export function getTodayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function getResetAt() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }

  const nextDayUtc = Date.UTC(Number(year), Number(month) - 1, Number(day) + 1, -8, 0, 0)
  return new Date(nextDayUtc).toISOString()
}

export function getDateStamp() {
  return getTodayKey().replaceAll('-', '')
}
