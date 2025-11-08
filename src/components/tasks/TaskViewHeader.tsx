import { ReactNode } from 'react'

interface TaskViewHeaderProps {
  total: number
  completed: number
  blocked: number
  actions?: ReactNode
}

export default function TaskViewHeader({ 
  total, 
  completed, 
  blocked,
  actions 
}: TaskViewHeaderProps) {
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="task-view-header">
      <div className="task-summary-stats">
        <span className="task-stat">
          <span className="task-stat-label">Total:</span>
          <span className="task-stat-value">{total}</span>
        </span>
        <span className="task-stat">
          <span className="task-stat-label">Completed:</span>
          <span className="task-stat-value text-green-600">{completed}</span>
        </span>
        <span className="task-stat">
          <span className="task-stat-label">Rate:</span>
          <span className="task-stat-value">{rate}%</span>
        </span>
        {blocked > 0 && (
          <span className="task-stat">
            <span className="task-stat-label">Blocked:</span>
            <span className="task-stat-value text-red-600">{blocked}</span>
          </span>
        )}
      </div>
      
      {actions && (
        <div className="task-header-actions">
          {actions}
        </div>
      )}
    </div>
  )
}
