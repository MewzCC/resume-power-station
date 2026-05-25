import type { TodayUsage } from '../../types/api'

type QuotaCardProps = {
  compact?: boolean
  isAuthenticated?: boolean
  isLoading?: boolean
  usage?: TodayUsage | null
}

export function QuotaCard({
  compact = false,
  isAuthenticated = false,
  isLoading = false,
  usage,
}: QuotaCardProps) {
  const remaining = usage?.remaining ?? 0
  const limit = usage?.limit ?? 3
  const used = usage?.used ?? 0
  const percent = usage ? Math.max(0, Math.min(100, ((limit - used) / limit) * 100)) : 0
  const label = isAuthenticated ? '今日免费次数' : '登录后查看次数'

  return (
    <article className={compact ? 'quota-card quota-card--compact' : 'quota-card'}>
      <span>{label}</span>
      <strong>
        {isLoading ? '...' : remaining}
        <small>/{limit}</small>
      </strong>
      {!compact && (
        <p>
          {isAuthenticated
            ? usage?.remaining === 0
              ? '今天的免费优化次数已用完。'
              : '次数由系统时间实时计算。'
            : '登录或注册后即可同步今日免费次数。'}
        </p>
      )}
      <div className="quota-bar">
        <i style={{ width: `${percent}%` }} />
      </div>
    </article>
  )
}
