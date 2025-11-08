import { ReactNode } from 'react'

interface TaskViewLayoutProps {
  title?: string
  summary?: ReactNode
  addBar?: ReactNode
  filters?: ReactNode
  children: ReactNode
}

export default function TaskViewLayout({ 
  title, 
  summary, 
  addBar, 
  filters,
  children 
}: TaskViewLayoutProps) {
  return (
    <div className="task-view-container">
      {/* Optional Title */}
      {title && (
        <div className="task-view-title">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        </div>
      )}

      {/* Summary Bar (Total, Completed, Blocked counts) */}
      {summary && (
        <div className="task-view-summary">
          {summary}
        </div>
      )}

      {/* Add Task Bar */}
      {addBar && (
        <div className="task-view-addbar">
          {addBar}
        </div>
      )}

      {/* Filters (optional) */}
      {filters && (
        <div className="task-view-filters">
          {filters}
        </div>
      )}

      {/* Main Task List */}
      <div className="task-view-content">
        {children}
      </div>
    </div>
  )
}
