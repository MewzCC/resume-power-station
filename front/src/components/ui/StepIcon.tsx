import type { ReactNode } from 'react'

export function StepIcon({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span>
      {icon}
      <small>{label}</small>
    </span>
  )
}
