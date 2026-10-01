import { useState } from 'react';
import type { Task } from '../../types';
import { t } from '../../i18n/translations';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { CompactTaskCard } from './CompactTaskCard';

/**
 * Overdue section of the Tasks screen. The caller passes the overdue tasks it
 * already filtered (search, chip filters) and excluded from its other
 * sections, so every task is rendered exactly once.
 */
export const DueDateNotifications = ({ tasks }: { tasks: Task[] }) => {
  const [expanded, setExpanded] = useState(true);

  if (tasks.length === 0) return null;

  return (
    <section data-testid="overdue-section" className="pt-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="mb-2 flex min-h-[var(--app-touch-target)] w-full items-center gap-2 px-1 text-left"
      >
        <AlertCircle className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-orange-600">
          {t('common.overdue')} ({tasks.length})
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-orange-400 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 text-orange-400 ml-auto" />
        )}
      </button>
      {expanded && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <CompactTaskCard key={task.id} task={task} showCheckbox urgent />
          ))}
        </div>
      )}
    </section>
  );
};
