import type { ReactNode } from 'react'

type FormStepProps = {
  children: ReactNode
  index: number
  title: string
}

export function FormStep({ children, index, title }: FormStepProps) {
  return (
    <section className="form-step">
      <h3>
        <b>{index}</b>
        {title}
      </h3>
      {children}
    </section>
  )
}
