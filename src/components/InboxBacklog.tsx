import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AppHeader } from './shared/NewGlobalHeader';
import { Inbox, Rows2, AlertTriangle, Check, ArrowRight, CheckCheck } from 'lucide-react';
import { t, formatDate } from '../i18n/translations';
import { StatCard } from './shared/StatCard';
import { EmptyState } from './shared/EmptyState';
import { TaskCard } from './shared/TaskCard';

export const InboxBacklog = () => {
  const { tasks, updateTask, addTask, activeChipFilters, toggleChipFilter, clearChipFilters, showCompletionMessage } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<InboxSortMode>('alpha');

  // Sort modes reuse the shared AppHeader sort pattern (same as Tasks/Groceries):
  // filter = which items are visible (chips/search), sort = their order only.
  type InboxSortMode = 'alpha' | 'alphaDesc' | 'newest' | 'oldest' | 'priority';
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

  // Sort is applied AFTER search + chip filters (filter = visible set, sort = order).
  const sortInboxTasks = (list: any[], mode: InboxSortMode) => {
    const sorted = [...list];
    switch (mode) {
      case 'alphaDesc':
        sorted.sort((a, b) => b.title.toLowerCase().localeCompare(a.title.toLowerCase()));
        break;
      case 'newest':
        sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
        break;
      case 'oldest':
        sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
        break;
      case 'priority':
        sorted.sort((a, b) => {
          const pa = PRIORITY_ORDER[a.priority || ''] ?? 99;
          const pb = PRIORITY_ORDER[b.priority || ''] ?? 99;
          if (pa !== pb) return pa - pb;
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

  // Helper: filter out subtask-linked tasks (they appear under their parent)
  const isNotSubtask = (t: any) => !(t.linkedType === 'task' && t.linkedTo);

  // Mirrors TasksView: focus = explicit flag OR (due within 24h AND high priority)
  const isDueWithin24h = (dueDate?: number): boolean => {
    if (!dueDate) return false;
    const now = Date.now();
    const diff = dueDate - now;
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  };

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
    // Only tasks still in 'done' count — a reopened/backlog task must not keep
    // counting even if a stale completed_at survived (GH#80).
    if (t.status !== 'done' || !t.completedAt) return false;
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
    // Status chips from the shared header dropdown (TasksView semantics):
    // 'done' must not fall through to the backlog default (fallthrough bug).
    if (activeStatusFilter === 'done') {
      return filtered.filter((t) => t.status === 'done' && !t.archived);
    }
    if (activeStatusFilter === 'focus') {
      return filtered.filter((t) => (!!t.focus || (isDueWithin24h(t.dueDate) && t.priority === 'high')) && !t.archived);
    }

    return filtered.filter((t) => t.status === 'backlog' && !t.archived);
  };

  const displayedTasks = sortInboxTasks(getFilteredTasks(), sortMode);
  const statusSections = [
    { key: 'backlog', label: t('dashboard.inbox'), value: backlogCount, icon: Inbox, tone: 'inbox' as const },
    { key: 'todo', label: t('dashboard.todoSprint'), value: todoCount, icon: Rows2, tone: 'todo' as const },
    { key: 'blocked', label: t('dashboard.blocked'), value: blockedCount, icon: AlertTriangle, tone: 'blocked' as const },
    { key: 'done-today', label: t('dashboard.doneSprint'), value: doneToday, icon: CheckCheck, tone: 'done' as const },
  ];

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
    selectedIds.forEach((id) => updateTask(id, { status: 'todo', completedAt: undefined, completedBy: undefined }));
    exitSelectMode();
  };

  return (
    <>
      <div className="sticky top-0 z-40">
        <AppHeader
          screen="inbox"
          onAdd={handleAddTaskWithValue}
          onSearch={setSearchQuery}
          searchPlaceholder={t('inbox.searchPlaceholder')}
          count={displayedTasks.length}
          sortValue={sortMode}
          onSortChange={(value) => setSortMode(value as InboxSortMode)}
          sortOptions={[
            { value: 'alpha', label: t('settings.sortAlpha') },
            { value: 'alphaDesc', label: t('settings.sortAlphaReverse') },
            { value: 'newest', label: t('settings.sortNewest') },
            { value: 'oldest', label: t('settings.sortOldest') },
            { value: 'priority', label: t('filters.priority') },
          ]}
        />
      </div>

        <div className="max-w-lg mx-auto px-4 pt-3 space-y-4 pb-20">
          {/* Stat boxes — clickable as filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '8px 16px 16px' }} className="-mx-4">
            {statusSections.map((stat) => (
              <StatCard
                key={stat.key}
                testId={`inbox-stat-card-${stat.key}`}
                status={stat.key}
                label={stat.label}
                value={stat.value}
                icon={<stat.icon className="h-5 w-5 text-white" strokeWidth={2.25} />}
                tone={stat.tone}
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
                {displayedTasks.length === 0 ? (
                  <EmptyState title={t('inbox.noTasksFound')} icon={<Inbox className="h-7 w-7" />} />
                ) : (
                  <div className="space-y-2">
                    {displayedTasks.map((task) => (
                      <TaskCard key={task.id} task={task} showCheckbox={true} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-end gap-3">
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
                  <EmptyState title={t('inbox.inboxIsEmpty')} icon={<Inbox className="h-7 w-7" />} />
                ) : (
                  <div className="space-y-2">
                    {displayedTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2">
                        {isSelecting && (
                          <button
                            onClick={() => toggleSelect(task.id)}
                            className={`app-checkbox flex flex-shrink-0 items-center justify-center transition-colors ${
                              selectedIds.has(task.id)
                                ? 'app-checkbox-checked'
                                : ''
                            }`}
                            aria-label={selectedIds.has(task.id) ? t('inbox.deselectAll') : t('inbox.selectAll')}
                          >
                            {selectedIds.has(task.id) && <Check className="w-3 h-3" />}
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <TaskCard task={task} showCheckbox={false} />
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
