import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronDown, ChevronUp, Trash2, CheckSquare, X as XIcon, Save, ChevronRight, AlertTriangle, Clock, Target, Lock, Tag } from 'lucide-react';
import { NewGlobalHeader } from './shared/NewGlobalHeader';

import { DueDateNotifications } from './shared/DueDateNotifications';
import { t, formatDate } from '../i18n/translations';
import { TaskCard } from './shared/TaskCard';
import { SectionHeader } from './shared/SectionHeader';
import { EmptyState } from './shared/EmptyState';

type SortMode = 'alpha' | 'priority' | 'dueDate';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface SprintFilterChip {
  id: string;
  label: string;
  count: number;
  color: string;
}

function SprintFilterChips({
  filters,
  activeIds,
  onToggle,
}: {
  filters: SprintFilterChip[];
  activeIds: string[];
  onToggle: (filter: SprintFilterChip) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" aria-label="Sprint filters">
      {filters.map((filter) => {
        const active = activeIds.includes(filter.id);
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onToggle(filter)}
            className={`app-chip inline-flex min-h-[var(--app-touch-target)] flex-shrink-0 items-center gap-2 px-3 text-xs font-black ${active ? 'text-white shadow-sm' : 'bg-white text-[var(--app-text-muted)] shadow-sm'}`}
            style={active ? { backgroundColor: filter.color } : undefined}
          >
            <span>{filter.label}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{filter.count}</span>
          </button>
        );
      })}
    </div>
  );
}

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
  const { tasks, labels, filters, activeLabelFilters, activeChipFilters, toggleChipFilter, clearChipFilters, addTask, addFilter, deleteFilter, uncheckAllDoneTasks, deleteTask, showCompletionMessage } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showBlocked, setShowBlocked] = useState(true);
  const [showFocus, setShowFocus] = useState(true);
  const [showSavedFilters, setShowSavedFilters] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('alpha');

  const taskFilters = useMemo(() => filters.filter(f => f.type === 'task'), [filters]);

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

  const applySavedFilter = (f: typeof filters[0]) => {
    clearChipFilters();
    if (f.chipFilters) {
      for (const cf of f.chipFilters) {
        toggleChipFilter(cf.type, cf.id, cf.label, cf.color);
      }
    }
    setShowSavedFilters(false);
    showCompletionMessage(`Filter: ${f.name}`);
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    // Hide subtask tasks from main list
    filtered = filtered.filter(task => !(task.linkedType === 'task' && task.linkedTo));

    // Label filters (existing)
    if (activeLabelFilters.length > 0) {
      filtered = filtered.filter(task =>
        activeLabelFilters.every(filterId => task.labels.includes(filterId))
      );
    }

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

  const hasAnyFilter = activeChipFilters.length > 0;
  const hasSavedFilters = taskFilters.length > 0;

  const isEmpty = focusTasks.length === 0 && blockedTasks.length === 0 && regularTasks.length === 0 && completedTasks.length === 0;
  const statusQuickFilters = [
    { id: 'todo', label: t('dashboard.todoSprint'), count: regularTasks.length, color: '#16a34a' },
    { id: 'focus', label: t('tasks.focus'), count: focusTasks.length, color: '#f97316' },
    { id: 'blocked', label: t('dashboard.blocked'), count: blockedTasks.length, color: '#e11d48' },
    { id: 'done', label: t('dashboard.doneSprint'), count: completedTasks.length, color: '#7c3aed' },
  ];
  const visibleTaskLabelIds = new Set(tasks.flatMap((task) => task.labels || []));
  const visibleLabels = labels.filter((label) => visibleTaskLabelIds.has(label.id));
  const activeLabelChipIds = activeChipFilters.filter((f) => f.type === 'label').map((f) => f.id);
  const clearLabelChips = () => {
    activeLabelChipIds.forEach((id) => toggleChipFilter('label', id));
  };

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

      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Single compact filter rail: quick filters + label chips + active inline × + Reset */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          <SprintFilterChips
            filters={statusQuickFilters}
            activeIds={activeChipFilters.filter((f) => f.type === 'status').map((f) => f.id)}
            onToggle={(filter) => toggleChipFilter('status', filter.id, filter.label, filter.color)}
          />
          {visibleLabels.length > 0 && (
            <>
              {/* Separator */}
              <div className="w-px h-6 bg-neutral-200 flex-shrink-0 mx-0.5" />
              {visibleLabels.map((label) => {
                const active = activeLabelChipIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleChipFilter('label', label.id, label.name, label.color)}
                    className="inline-flex min-h-8 flex-shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-bold shadow-sm"
                    style={{
                      background: active ? `${label.color}18` : 'white',
                      color: active ? label.color : 'var(--app-text-muted)',
                      borderColor: active ? `${label.color}35` : 'var(--app-border-subtle)',
                    }}
                  >
                    <Tag className="h-3 w-3" />
                    {label.name}
                  </button>
                );
              })}
            </>
          )}
          {/* Reset ✕ — only when any filter is active */}
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearChipFilters}
              className="inline-flex min-h-8 flex-shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-bold shadow-sm text-red-600 border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <XIcon className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
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
