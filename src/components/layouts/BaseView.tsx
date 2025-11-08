import { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  actions?: ReactNode
}

export default function BaseView({ title, children, actions }: Props) {
  return (
    <section className="base-view">
      <header className="page-header">
        <div className="flex items-center justify-between">
          <h2 className="page-title">{title}</h2>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      </header>

      <main className="page-content">
        {children}
      </main>
    </section>
  )
}
