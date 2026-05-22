import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronDown, ChevronUp, RotateCcw, CheckSquare, X as XIcon, Save, AlertTriangle } from 'lucide-react';
import { CompactTaskCard } from './shared/CompactTaskCard';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { TopBar } from './shared/TopBar';
import { DueDateNotifications } from './shared/DueDateNotifications';

export const TasksView = () => {
  const { tasks, activeLabelFilters, activeChipFilters, toggleChipFilter, clearChipFilters, addTask, uncheckAllDoneTasks, showCompletionMessage } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckedOut, setShowCheckedOut] = useState(false);

  const handleAddTaskWithValue = (value: string, metadata?: { assignee?: string; labels?: string[]; dueDate?: number }) => {
    addTask({
      title: value,
      status: 'todo',
      blocked: false,
      labels: metadata?.labels || [],
      assignedTo: metadata?.assignee,
      dueDate: metadata?.dueDate,
      flag: false,
    });
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    // Hide subtask tasks from main list (they render inline in parent's expandable section)
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

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredTasks = getFilteredTasks();

  // Separate into active and checked out sections
  const activeTasks = filteredTasks.filter(task => task.status === 'todo');
  const checkedOutTasks = filteredTasks.filter(task => task.status === 'done');

  // Sort active tasks alphabetically A-Z (case-insensitive)
  const sortedActiveTasks = [...activeTasks].sort((a, b) => {
    return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
  });

  const hasAnyFilter = activeChipFilters.length > 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-shrink-0">
        <NewGlobalHeader
          onAdd={handleAddTaskWithValue}
          onSearch={setSearchQuery}
          searchPlaceholder="Search tasks..."
        />
      </div>
      <div className="flex-1 overflow-y-auto bg-neutral-50">
        {/* Filter bar */}
        {hasAnyFilter && (
          <div className="sticky top-0 z-30 bg-white border-b border-neutral-200 shadow-sm">
            <div className="max-w-lg mx-auto px-4 py-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-600">
              {activeTasks.length > 0
                ? `Tasks (${activeTasks.length + checkedOutTasks.length})`
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
                  <button onClick={() => toggleChipFilter(f.type, f.id)} className="ml-0.5 hover:opacity-70">
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
              onClick={() => {
                showCompletionMessage('Filter saved (not yet implemented)');
              }}
              className="flex-shrink-0 p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded"
              title="Save filter"
              aria-label="Save filter"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Active Tasks — blocked items sorted to top */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-neutral-600 flex items-center gap-1.5">
              Tasks ({activeTasks.length})
            </h2>
          </div>
          {activeTasks.length === 0 && checkedOutTasks.length === 0 ? (
            <div className="text-center py-16">
              <CheckSquare className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
              <p className="text-neutral-400 text-sm">No tasks found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedActiveTasks.map((task) => (
                <CompactTaskCard
                  key={task.id}
                  task={task}
                  showCheckbox={true}
                />
              ))}
            </div>
          )}
        </div>

        {/* Checked Out Tasks */}
        {checkedOutTasks.length > 0 && (
          <div className="border-t border-neutral-200 pt-4">
            <div className="flex items-center justify-between w-full px-1 mb-2">
              <button
                onClick={() => setShowCheckedOut(!showCheckedOut)}
                className="flex items-center gap-2"
              >
                <h2 className="text-sm font-semibold text-neutral-700">
                  Checked Out ({checkedOutTasks.length})
                </h2>
                {showCheckedOut ? (
                  <ChevronUp className="w-4 h-4 text-neutral-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-500" />
                )}
              </button>

              <button
                onClick={() => {
                  uncheckAllDoneTasks();
                  showCompletionMessage('All tasks checked back in');
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                title="Check in all tasks"
              >
                <RotateCcw className="w-3 h-3" />
                Check In All
              </button>
            </div>

            {showCheckedOut && (
              <div className="space-y-2">
                {checkedOutTasks.map((task) => (
                  <CompactTaskCard
                    key={task.id}
                    task={task}
                    showCheckbox={task.status === 'done'}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <DueDateNotifications />
    </div>
    </div>
  );
};
