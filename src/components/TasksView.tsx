import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronDown, ChevronUp, Trash2, CheckSquare, Target, Lock } from 'lucide-react';
import { NewGlobalHeader } from './shared/NewGlobalHeader';

import { DueDateNotifications } from './shared/DueDateNotifications';
import { t, formatDate } from '../i18n/translations';
import { TaskCard } from './shared/TaskCard';
import { SectionHeader } from './shared/SectionHeader';
import { EmptyState } from './shared/EmptyState';

type SortMode = 'alpha' | 'priority' | 'dueDate';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const isDueWithin24h = (dueDate?: number): boolean => {
  if (!dueDate) return false;
  const now = Date.now();
  const diff = dueDate - now;
  return diff > 0 && diff <= 24 * 60 * 60 * 1000;
};

const isOverdue = (dueDate?: number): boolean => {
  if (!dueDate) return false;
  return dueDate < Date.now();
};

export const TasksView = () => {
  const { tasks, activeChipFilters, addTask, uncheckAllDoneTasks, deleteTask, showCompletionMessage } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showBlocked, setShowBlocked] = useState(true);
  const [showFocus, setShowFocus] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('alpha');

  const handleAddTaskWithValue = (value: string, metadata?: { assignee?: string; labels?: string[]; dueDate?: number }) => {
    if (!value.trim()) return;
    addTask({
      title: value.trim(),
      status: 'todo',
      blocked: false,
      labels: metadata?.labels || [],
      assignedTo: metadata?.assignee,
      dueDate: metadata?.dueDate,
      flag: false,
    });
    showCompletionMessage(t('inbox.taskAdded'));
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    // Hide subtask tasks from main list
    filtered = filtered.filter(task => !(task.linkedType === 'task' && task.linkedTo));

    // Chip filters (labels, assignee, shop, date, repeat, status)
    for (const f of activeChipFilters) {
      switch (f.type) {
        case 'label':
          filtered = filtered.filter((t) => t.labels.includes(f.id));
          break;
        case 'assignee':
          filtered = filtered.filter((t) => t.assignedTo === f.id);
          break;
        case 'date':
          filtered = filtered.filter((t) => {
            if (!t.dueDate) return false;
            const ds = formatDate(t.dueDate, { month: 'short', day: 'numeric' });
            return ds === f.id;
          });
          break;
        case 'repeat':
          filtered = filtered.filter((t) => {
            return t.repeatInterval === f.id;
          });
          break;
        case 'priority':
          filtered = filtered.filter((t) => t.priority === f.id);
          break;
        case 'status':
          if (f.id === 'focus') filtered = filtered.filter((t) => !!t.focus || (isDueWithin24h(t.dueDate) && t.priority === 'high'));
          if (f.id === 'blocked') filtered = filtered.filter((t) => !!t.blocked);
          if (f.id === 'todo') filtered = filtered.filter((t) => t.status === 'todo' && !t.blocked);
          if (f.id === 'done') filtered = filtered.filter((t) => t.status === 'done');
          break;
      }
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredTasks = getFilteredTasks();

  // Separate into sections
  const activeTasks = filteredTasks.filter(task => task.status === 'todo');
  const completedTasks = filteredTasks.filter(task => task.status === 'done');

  // Focus: tasks with focus=true OR (due <24h AND high priority) — not blocked, not done
  const focusTasks = activeTasks.filter(task =>
    !task.blocked && (task.focus || (isDueWithin24h(task.dueDate) && task.priority === 'high'))
  );

  // Blocked: blocked tasks
  const blockedTasks = activeTasks.filter(task => task.blocked && !focusTasks.includes(task));

  // Regular tasks: remaining active tasks
  const regularTasks = activeTasks.filter(task =>
    !focusTasks.includes(task) && !blockedTasks.includes(task)
  );

  // Sort helper
  const sortTasks = (taskList: typeof activeTasks) => {
    const sorted = [...taskList];
    switch (sortMode) {
      case 'priority':
        sorted.sort((a, b) => {
          const pa = PRIORITY_ORDER[a.priority || ''] ?? 99;
          const pb = PRIORITY_ORDER[b.priority || ''] ?? 99;
          if (pa !== pb) return pa - pb;
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        });
        break;
      case 'dueDate':
        sorted.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          if (a.dueDate !== b.dueDate) return a.dueDate - b.dueDate;
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        });
        break;
      case 'alpha':
      default:
        sorted.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
        break;
    }
    return sorted;
  };

  const sortedFocusTasks = sortTasks(focusTasks);
  const sortedBlockedTasks = sortTasks(blockedTasks);
  const sortedRegularTasks = sortTasks(regularTasks);
  const sortedCompletedTasks = sortTasks(completedTasks);

  const isEmpty = focusTasks.length === 0 && blockedTasks.length === 0 && regularTasks.length === 0 && completedTasks.length === 0;

  return (
    <>
      <div className="sticky top-0 z-40">
        <NewGlobalHeader
          screen="taken"
          onAdd={handleAddTaskWithValue}
          onSearch={setSearchQuery}
          searchPlaceholder={t('tasks.searchPlaceholder')}
          count={activeTasks.length}
          sortValue={sortMode}
          onSortChange={(value) => setSortMode(value as SortMode)}
          sortOptions={[
            { value: 'alpha', label: 'A-Z' },
            { value: 'priority', label: t('filters.priority') },
            { value: 'dueDate', label: t('filters.dueDate') },
          ]}
        />
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-4">
        {isEmpty ? (
          <EmptyState title={t('inbox.empty')} icon={<CheckSquare className="h-7 w-7" />} />
        ) : (
          <>
            {/* OVERDUE section — always below sort header */}
            <DueDateNotifications />

            {/* FOCUS section */}
            {sortedFocusTasks.length > 0 && (
              <div>
                <button
                  onClick={() => setShowFocus(!showFocus)}
                  className="mb-2 flex min-h-[var(--app-touch-target)] w-full items-center gap-2 px-1 text-left"
                >
                  <Target className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-semibold text-orange-600">
                    {t('tasks.focus')} ({sortedFocusTasks.length})
                  </h3>
                  {showFocus ? (
                    <ChevronUp className="w-4 h-4 text-orange-400 ml-auto" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-orange-400 ml-auto" />
                  )}
                </button>
                {showFocus && (
                  <div className="space-y-2">
                    {sortedFocusTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showCheckbox={true}
                        urgent={true}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* BLOCKED section */}
            {sortedBlockedTasks.length > 0 && (
              <div>
                <button
                  onClick={() => setShowBlocked(!showBlocked)}
                  className="mb-2 flex min-h-[var(--app-touch-target)] w-full items-center gap-2 px-1 text-left"
                >
                  <Lock className="w-4 h-4 text-red-500" />
                  <h3 className="text-sm font-semibold text-red-600">
                    {t('inbox.blocked')} ({sortedBlockedTasks.length})
                  </h3>
                  {showBlocked ? (
                    <ChevronUp className="w-4 h-4 text-red-400 ml-auto" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-red-400 ml-auto" />
                  )}
                </button>
                {showBlocked && (
                  <div className="space-y-2">
                    {sortedBlockedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showCheckbox={true}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TASKS section — always visible, no collapse */}
            {sortedRegularTasks.length > 0 && (
              <div className="space-y-2">
                {sortedRegularTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showCheckbox={true}
                  />
                ))}
              </div>
            )}

            {/* COMPLETED section */}
            {sortedCompletedTasks.length > 0 && (
              <div className="border-t border-neutral-200 pt-4">
                <div className="flex items-center justify-between w-full px-1 mb-2">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex min-h-[var(--app-touch-target)] items-center gap-2"
                  >
                    <h2 className="text-sm font-semibold text-neutral-700">
                      {t('common.completed')} ({sortedCompletedTasks.length})
                    </h2>
                    {showCompleted ? (
                      <ChevronUp className="w-4 h-4 text-neutral-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-500" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (!window.confirm(t('tasks.confirmDeleteCompleted'))) return;
                      const doneIds = sortedCompletedTasks.map(t => t.id);
                      doneIds.forEach(id => deleteTask(id));
                      showCompletionMessage(`${doneIds.length} deleted`);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3 h-3" />
                    {t('common.delete')}
                  </button>
                </div>

                {showCompleted && (
                  <div className="space-y-2">
                    {sortedCompletedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showCheckbox={task.status === 'done'}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
