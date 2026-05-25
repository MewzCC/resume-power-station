import { cn } from '../../lib/utils'

type MetricProps = {
  title: string
  value: string
  unit?: string
  tone?: 'green'
}

export function Metric({ title, value, unit = '', tone }: MetricProps) {
  return (
    <article className={cn('metric', tone === 'green' && 'metric--green')}>
      <span>{title}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </article>
  )
}
