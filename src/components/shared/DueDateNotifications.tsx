import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n/translations';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { CompactTaskCard } from './CompactTaskCard';

export const DueDateNotifications = () => {
  const { tasks } = useApp();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setDismissed(JSON.parse(localStorage.getItem('dismissedNotifications') || '[]'));
  }, []);

  const overdueTasks = useMemo(() => tasks
    .filter((task) => task.dueDate && task.status !== 'done' && !dismissed.includes(task.id) && task.dueDate < Date.now())
    .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0)), [dismissed, tasks]);

  if (overdueTasks.length === 0) return null;

  return (
    <section data-testid="overdue-section" className="pt-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex items-center gap-2 w-full mb-2 px-0 text-left"
      >
        <AlertCircle className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-orange-600">
          {t('common.overdue')} ({overdueTasks.length})
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-orange-400 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 text-orange-400 ml-auto" />
        )}
      </button>
      {expanded && (
        <div className="space-y-2">
          {overdueTasks.map((task) => (
            <CompactTaskCard key={task.id} task={task} showCheckbox urgent />
          ))}
        </div>
      )}
    </section>
  );
};
