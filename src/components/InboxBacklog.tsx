import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CompactTaskCard } from './shared/CompactTaskCard';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { PageHeader } from './shared/PageHeader';
import { Inbox, Rows2, AlertTriangle, X as XIcon, Save, Check, ArrowRight, CheckCheck, type LucideIcon } from 'lucide-react';
import { t, formatDate } from '../i18n/translations';

type InboxStatColor = 'blue' | 'emerald' | 'rose' | 'violet';

const inboxStatGradients: Record<InboxStatColor, string> = {
  blue: 'var(--app-status-inbox)',
  emerald: 'var(--app-status-todo)',
  rose: 'var(--app-status-blocked)',
  violet: 'var(--app-status-done)',
};

function InboxStatCard({
  statKey,
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  statKey: string;
  label: string;
  value: number;
  icon: LucideIcon;
  color: InboxStatColor;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`inbox-stat-card-${statKey}`}
      data-status={statKey}
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      title={`${label}: ${value}`}
      style={{ background: inboxStatGradients[color] }}
      className={`app-status-card relative isolate w-full min-w-0 overflow-hidden text-white ${
        active ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-50 dark:ring-offset-neutral-950' : ''
      }`}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/35" />
      <div className="relative z-10 flex h-full items-center gap-3">
        <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/25 backdrop-blur-sm" aria-hidden="true">
          <Icon className="h-5 w-5 text-white" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-[13px] font-bold leading-none text-white/90">{label}</span>
        <p className="flex-shrink-0 text-[32px] font-black leading-none tracking-[-0.05em] text-white drop-shadow-sm">{value}</p>
      </div>
    </button>
  );
}

export const InboxBacklog = () => {
  const { tasks, updateTask, addTask, activeChipFilters, toggleChipFilter, clearChipFilters, showCompletionMessage } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Helper: filter out subtask-linked tasks (they appear under their parent)
  const isNotSubtask = (t: any) => !(t.linkedType === 'task' && t.linkedTo);

  // Derive counts — exclude subtasks from all stat counts
  const backlogTasks = tasks
    .filter((t) => t.status === 'backlog')
    .filter((t) => !t.archived)
    .filter(isNotSubtask)
    .filter((t) => searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));

  const blockedTasks = tasks
    .filter((t) => t.blocked && !t.archived && t.status !== 'done' && t.status !== 'backlog')
    .filter(isNotSubtask);

  const backlogCount = backlogTasks.length;
  const todoCount = tasks.filter((t) => t.status === 'todo' && !t.archived && isNotSubtask(t)).length;
  const blockedCount = blockedTasks.length;
  const doneToday = tasks.filter((t) => {
    if (!t.completedAt) return false;
    const today = new Date();
    const completed = new Date(t.completedAt);
    return completed.toDateString() === today.toDateString() && isNotSubtask(t);
  }).length;

  // Status filter from stat boxes
  const activeStatusFilter = activeChipFilters.find((f) => f.type === 'status')?.id || null;

  // Determine which tasks to show based on active status filter
  const getFilteredTasks = () => {
    let filtered = tasks.filter(task => !(task.linkedType === 'task' && task.linkedTo));

    // Search filter first
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply chip filters (label, assignee, date, repeat) on ALL tasks first
    for (const f of activeChipFilters) {
      if (f.type === 'status') continue;
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
      }
    }

    // Then apply status filter on top of chip filters
    if (!activeStatusFilter || activeStatusFilter === 'backlog') {
      return filtered.filter((t) => t.status === 'backlog' && !t.archived);
    }
    if (activeStatusFilter === 'todo') {
      return filtered.filter((t) => t.status === 'todo' && !t.archived);
    }
    if (activeStatusFilter === 'done-today') {
      return filtered.filter((t) => {
        if (!t.completedAt) return false;
        const today = new Date();
        const completed = new Date(t.completedAt);
        return completed.toDateString() === today.toDateString();
      });
    }
    if (activeStatusFilter === 'blocked') {
      return filtered.filter((t) => t.blocked && !t.archived && t.status !== 'done' && t.status !== 'backlog');
    }

    return filtered.filter((t) => t.status === 'backlog' && !t.archived);
  };

  const displayedTasks = getFilteredTasks();
  const statusSections = [
    { key: 'backlog', label: t('dashboard.inbox'), value: backlogCount, icon: Inbox, color: 'blue' as const },
    { key: 'todo', label: t('dashboard.todoSprint'), value: todoCount, icon: Rows2, color: 'emerald' as const },
    { key: 'blocked', label: t('dashboard.blocked'), value: blockedCount, icon: AlertTriangle, color: 'rose' as const },
    { key: 'done-today', label: t('dashboard.doneSprint'), value: doneToday, icon: CheckCheck, color: 'violet' as const },
  ];

  const hasAnyFilter = activeStatusFilter || activeChipFilters.some((f) => f.type !== 'status');

  const handleAddTaskWithValue = (value: string, metadata?: { assignee?: string; labels?: string[]; dueDate?: number }) => {
    if (!value.trim()) return;
    addTask({
      title: value.trim(),
      status: 'backlog',
      labels: metadata?.labels || [],
      assignedTo: metadata?.assignee,
      dueDate: metadata?.dueDate,
    } as any);
    showCompletionMessage(t('inbox.taskAdded'));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectMode = () => {
    setIsSelecting(true);
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  };

  const pushSelected = () => {
    selectedIds.forEach((id) => updateTask(id, { status: 'todo' }));
    exitSelectMode();
  };

  return (
    <>
      <PageHeader title={t('inbox.title')} subtitle={`${displayedTasks.length} ${t('common.tasks').toLowerCase()}`} />
      <div className="sticky top-0 z-40">
        <NewGlobalHeader
          onAdd={handleAddTaskWithValue}
          onSearch={setSearchQuery}
          searchPlaceholder={t('inbox.searchPlaceholder')}
        />
      </div>

        {/* Filter bar — show when any filter is active */}
        {hasAnyFilter && (
          <div className="app-surface mx-3 my-2 shadow-sm">
            <div className="max-w-lg mx-auto px-4 py-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-600">
                {displayedTasks.length > 0
                  ? `${t('common.tasks')} (${displayedTasks.length})`
                  : t('inbox.noResults')}
              </span>
              <div className="flex gap-1 flex-1 flex-wrap">
                {activeChipFilters.map((f) => (
                  <span
                    key={`${f.type}-${f.id}`}
                    className="inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-xs font-normal leading-none border select-none"
                    style={{
                      backgroundColor: f.color ? `${f.color}20` : undefined,
                      color: f.color ? f.color : undefined,
                      borderColor: f.color ? `${f.color}40` : '#e5e7eb',
                    }}
                  >
                    {f.label || f.id}
                    <button
                      onClick={() => toggleChipFilter(f.type, f.id)}
                      className="ml-0.5 hover:opacity-70"
                    >
                      <XIcon className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={clearChipFilters}
                className="flex-shrink-0 p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded"
                title={t('common.clearAllTooltip')}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => showCompletionMessage(t('filters.saveUnavailable'))}
                className="flex-shrink-0 p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded"
                title={t('common.save')}
                aria-label={t('common.save')}
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="max-w-lg mx-auto px-4 pt-4 space-y-6 pb-20">
          {/* Stat boxes — clickable as filters */}
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {statusSections.map((stat) => (
              <InboxStatCard
                key={stat.key}
                statKey={stat.key}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                active={activeStatusFilter === stat.key}
                onClick={() => {
                  if (activeStatusFilter === stat.key) {
                    clearChipFilters();
                  } else {
                    clearChipFilters();
                    toggleChipFilter('status', stat.key, stat.label);
                  }
                }}
              />
            ))}
          </div>

          <div>
            {activeStatusFilter ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm text-neutral-600 flex items-center gap-1.5">
                    {statusSections.find((s) => s.key === activeStatusFilter)?.label || t('common.tasks')} ({displayedTasks.length})
                  </h2>
                </div>
                {displayedTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <Inbox className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                    <p className="text-neutral-400 text-sm">{t('inbox.noTasksFound')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {displayedTasks.map((task) => (
                      <CompactTaskCard key={task.id} task={task} showCheckbox={true} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm text-neutral-600 flex items-center gap-1.5">
                    {t('inbox.title')} ({displayedTasks.length})
                  </h2>
                  <div className="flex items-center gap-1">
                    {displayedTasks.length > 0 && !isSelecting && (
                      <button
                        onClick={enterSelectMode}
                        className="text-xs font-medium text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-100 transition-colors"
                      >
                        {t('inbox.selectAll')}
                      </button>
                    )}
                    {isSelecting && (
                      <>
                        <button
                          onClick={() => {
                            if (selectedIds.size === displayedTasks.length) {
                              setSelectedIds(new Set());
                            } else {
                              setSelectedIds(new Set(displayedTasks.map(t => t.id)));
                            }
                          }}
                          className="text-xs font-medium text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-100 transition-colors"
                        >
                          {selectedIds.size === displayedTasks.length ? t('inbox.deselectAll') : t('inbox.selectAll')}
                        </button>
                        <button
                          onClick={exitSelectMode}
                          className="text-xs font-medium text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-100 transition-colors"
                        >
                          {t('common.cancel')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {displayedTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <Inbox className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                    <p className="text-neutral-400 text-sm">{t('inbox.inboxIsEmpty')}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {displayedTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2">
                        {isSelecting && (
                          <button
                            onClick={() => toggleSelect(task.id)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              selectedIds.has(task.id)
                                ? 'bg-neutral-900 border-neutral-900 text-white'
                                : 'border-neutral-300 hover:border-neutral-500'
                            }`}
                            aria-label={selectedIds.has(task.id) ? t('inbox.deselectAll') : t('inbox.selectAll')}
                          >
                            {selectedIds.has(task.id) && <Check className="w-3 h-3" />}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <CompactTaskCard task={task} showCheckbox={false} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      {/* Floating bottom bar — batch push */}
      {isSelecting && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 app-bottom-nav pb-[env(safe-area-inset-bottom,0px)]">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-600">
              {selectedIds.size} {t('inbox.selectAll').toLowerCase()}
            </span>
            <button
              onClick={pushSelected}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors active:scale-95"
            >
              <ArrowRight className="w-4 h-4" />
              {t('inbox.pushSelected')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
