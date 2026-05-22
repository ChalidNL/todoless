import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CompactTaskCard } from './shared/CompactTaskCard';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { Inbox, Clock, AlertTriangle, X as XIcon, Save, Check, ArrowRight } from 'lucide-react';

export const InboxBacklog = () => {
  const { tasks, updateTask, addTask, activeChipFilters, toggleChipFilter, clearChipFilters, showCompletionMessage } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Derive counts
  const backlogTasks = tasks
    .filter((t) => t.status === 'backlog')
    .filter((t) => !t.archived)
    .filter((t) => searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));

  const blockedTasks = tasks
    .filter((t) => t.blocked && !t.archived && t.status !== 'done' && t.status !== 'backlog');

  const backlogCount = backlogTasks.length;
  const todoCount = tasks.filter((t) => t.status === 'todo' && !t.archived).length;
  const blockedCount = blockedTasks.length;
  const doneToday = tasks.filter((t) => {
    if (!t.completedAt) return false;
    const today = new Date();
    const completed = new Date(t.completedAt);
    return completed.toDateString() === today.toDateString();
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
            const ds = new Date(t.dueDate).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' });
            return ds === f.id;
          });
          break;
        case 'repeat':
          filtered = filtered.filter((t) => {
            const rl = t.repeatInterval
              ? { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[t.repeatInterval]
              : null;
            return rl === f.id;
          });
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
    { key: 'backlog', label: 'Inbox', value: backlogCount, icon: <Inbox className="w-4 h-4 text-blue-500" /> },
    { key: 'todo', label: 'Todo', value: todoCount, icon: <Clock className="w-4 h-4 text-green-500" /> },
    { key: 'done-today', label: 'Done Today', value: doneToday, icon: <Clock className="w-4 h-4 text-emerald-500" /> },
    { key: 'blocked', label: 'Blocked', value: blockedCount, icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
  ];

  const hasAnyFilter = activeStatusFilter || activeChipFilters.some((f) => f.type !== 'status');

  const handleAddTaskWithValue = (value: string, metadata?: { assignee?: string; labels?: string[]; dueDate?: number }) => {
    if (!value.trim()) return;
    addTask({
      title: value.trim(),
      status: 'backlog',
      priority: 'normal',
      labels: metadata?.labels || [],
      assignedTo: metadata?.assignee,
      dueDate: metadata?.dueDate,
    } as any);
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
    <div className="flex-1 min-h-0 flex flex-col bg-neutral-50">
      <div className="flex-shrink-0">
        <NewGlobalHeader
          onAdd={handleAddTaskWithValue}
          onSearch={setSearchQuery}
          searchPlaceholder="Search inbox..."
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Filter bar — show when any filter is active */}
        {hasAnyFilter && (
          <div className="sticky top-0 z-30 bg-white border-b border-neutral-200 shadow-sm">
            <div className="max-w-lg mx-auto px-4 py-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-600">
                {displayedTasks.length > 0
                  ? `Tasks (${displayedTasks.length})`
                  : 'No results'}
              </span>
              <div className="flex gap-1 flex-1 flex-wrap">
                {activeChipFilters.map((f) => (
                  <span
                    key={`${f.type}-${f.id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
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
                title="Clear all filters"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => showCompletionMessage('Filter saved (not yet implemented)')}
                className="flex-shrink-0 p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded"
                title="Save filter"
                aria-label="Save filter"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="max-w-lg mx-auto px-4 pt-4 space-y-6 pb-20">
          {/* Stat boxes — clickable as filters */}
          <div className="grid grid-cols-4 gap-2">
            {statusSections.map((stat) => (
              <button
                key={stat.key}
                onClick={() => {
                  if (activeStatusFilter === stat.key) {
                    clearChipFilters();
                  } else {
                    clearChipFilters(); // clear first, then set status
                    toggleChipFilter('status', stat.key, stat.label);
                  }
                }}
                className={`bg-white rounded-lg border p-3 text-left transition-all active:scale-95 ${
                  activeStatusFilter === stat.key
                    ? 'border-neutral-900 ring-1 ring-neutral-900'
                    : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {stat.icon}
                  <span className="text-xs text-neutral-500">{stat.label}</span>
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
              </button>
            ))}
          </div>

          <div>
            {activeStatusFilter ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm text-neutral-600 flex items-center gap-1.5">
                    {statusSections.find((s) => s.key === activeStatusFilter)?.label || 'Tasks'} ({displayedTasks.length})
                  </h2>
                </div>
                {displayedTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <Inbox className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                    <p className="text-neutral-400 text-sm">No tasks in this section</p>
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
                    Inbox ({displayedTasks.length})
                  </h2>
                  {displayedTasks.length > 0 && !isSelecting && (
                    <button
                      onClick={enterSelectMode}
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-100 transition-colors"
                    >
                      Select
                    </button>
                  )}
                  {isSelecting && (
                    <button
                      onClick={exitSelectMode}
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-100 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {displayedTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <Inbox className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
                    <p className="text-neutral-400 text-sm">Inbox is empty</p>
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
                            aria-label={selectedIds.has(task.id) ? 'Deselect' : 'Select'}
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
      </div>

      {/* Floating bottom bar — batch push */}
      {isSelecting && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-lg pb-[env(safe-area-inset-bottom,0px)]">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-600">
              {selectedIds.size} selected
            </span>
            <button
              onClick={pushSelected}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors active:scale-95"
            >
              <ArrowRight className="w-4 h-4" />
              Push
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
