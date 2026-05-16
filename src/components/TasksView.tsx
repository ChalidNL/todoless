import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, X, Filter as FilterIcon, ChevronDown, ChevronUp, RotateCcw, Search } from 'lucide-react';
import { CompactTaskCard } from './shared/CompactTaskCard';
import { LabelBadge } from './shared/LabelBadge';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { FilterPanel } from './shared/FilterPanel';
import { TopBar } from './shared/TopBar';
import { DueDateNotifications } from './shared/DueDateNotifications';
import { filterTasks, JQL_FIELDS, parseJQL } from '../lib/jql-parser';

export const TasksView = () => {
  const { tasks, labels, filters, activeLabelFilters, toggleLabelFilter, clearLabelFilters, addFilter, addTask, uncheckAllDoneTasks, showCompletionMessage } = useApp();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [jqlQuery, setJqlQuery] = useState('');
  const [showJqlHelp, setShowJqlHelp] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [showCheckedOut, setShowCheckedOut] = useState(false);

  const handleAddTask = () => {
    addTask({
      title: '',
      status: 'todo',
      blocked: false,
      labels: [],
    });
  };

  const handleAddTaskWithValue = (value: string, metadata?: { assignee?: string; labels?: string[]; dueDate?: number }) => {
    addTask({
      title: value,
      status: 'todo',
      labels: metadata?.labels || [],
      assignedTo: metadata?.assignee,
      dueDate: metadata?.dueDate,
    });
  };

  const handleCreateFilter = () => {
    if (newFilterName.trim() && activeLabelFilters.length > 0) {
      addFilter({
        name: newFilterName.trim(),
        labelIds: activeLabelFilters,
        showCompleted: true,
        type: 'task',
      });
      setNewFilterName('');
    }
  };

  const getFilteredTasks = () => {
    let filtered = tasks;

    // JQL filter
    if (jqlQuery.trim()) {
      // Create label resolver: maps label names to IDs
      const labelMap = new Map<string, string>();
      labels.forEach(l => labelMap.set(l.name.toLowerCase(), l.id));
      
      const labelResolver = (name: string): string | null => {
        return labelMap.get(name.toLowerCase()) || null;
      };
      
      filtered = filterTasks(jqlQuery, filtered as any, labelResolver) as typeof tasks;
    }

    // Label filters
    if (activeLabelFilters.length > 0) {
      filtered = filtered.filter(task =>
        activeLabelFilters.every(filterId => task.labels.includes(filterId))
      );
    }

    // Saved filter
    if (selectedFilterId) {
      const savedFilter = filters.find(f => f.id === selectedFilterId);
      if (savedFilter) {
        if (savedFilter.type === 'task') {
          // Already tasks
        }
        if (savedFilter.query) {
          // JQL query from saved filter
          const labelMap = new Map<string, string>();
          labels.forEach(l => labelMap.set(l.name.toLowerCase(), l.id));
          const labelResolver = (name: string): string | null => {
            return labelMap.get(name.toLowerCase()) || null;
          };
          filtered = filterTasks(savedFilter.query, filtered as any, labelResolver) as typeof tasks;
        }
        if (savedFilter.labelIds.length > 0) {
          filtered = filtered.filter(task =>
            savedFilter.labelIds.every(labelId => task.labels.includes(labelId))
          );
        }
        if (!savedFilter.showCompleted) {
          filtered = filtered.filter(t => t.status !== 'done');
        }
      }
    }

    // Search filter (legacy, only if no JQL)
    if (searchQuery && !jqlQuery.trim()) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredTasks = getFilteredTasks();
  
  // Separate active and checked out tasks
  const activeTasks = filteredTasks.filter(task => task.status !== 'done');
  const checkedOutTasks = filteredTasks.filter(task => task.status === 'done');

  // Sort active tasks: urgent priority first, then normal, then low, then no priority
  const sortedActiveTasks = [...activeTasks].sort((a, b) => {
    const priorityOrder = { urgent: 0, normal: 1, low: 2, undefined: 3 };
    const aPriority = a.priority || 'undefined';
    const bPriority = b.priority || 'undefined';
    return priorityOrder[aPriority] - priorityOrder[bPriority];
  });

  const activeLabelObjects = activeLabelFilters.map(id => labels.find(l => l.id === id)).filter(Boolean);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <TopBar />
      {/* Global Header */}
      <NewGlobalHeader
        onAdd={handleAddTaskWithValue}
        onSearch={setSearchQuery}
        searchPlaceholder="Search tasks..."
      />

      {/* Active filters bar */}
      {(activeLabelFilters.length > 0 || selectedFilterId) && (
        <div className="bg-white border-b border-neutral-200 sticky top-[105px] z-10">
          <div className="max-w-2xl mx-auto px-4 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-neutral-500">Active:</span>
              {activeLabelObjects.map(label => label && (
                <button
                  key={label.id}
                  onClick={() => toggleLabelFilter(label.id)}
                  className="flex items-center gap-1"
                >
                  <LabelBadge label={label} />
                  <X className="w-3 h-3 text-neutral-400" />
                </button>
              ))}
              {selectedFilterId && (
                <button
                  onClick={() => setSelectedFilterId(null)}
                  className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs flex items-center gap-1 hover:bg-neutral-200"
                >
                  {filters.find(f => f.id === selectedFilterId)?.name}
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => {
                  clearLabelFilters();
                  setSelectedFilterId(null);
                }}
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JQL Query Bar */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            <input
              type="text"
              value={jqlQuery}
              onChange={(e) => setJqlQuery(e.target.value)}
              placeholder="Filter: status:todo #work OR #personal NOT blocked..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-neutral-400"
            />
            {jqlQuery && (
              <button
                onClick={() => setJqlQuery('')}
                className="p-1 hover:bg-neutral-100 rounded"
              >
                <X className="w-3 h-3 text-neutral-400" />
              </button>
            )}
            <button
              onClick={() => setShowJqlHelp(!showJqlHelp)}
              className="text-xs text-neutral-500 hover:text-neutral-700 px-2 py-1 rounded hover:bg-neutral-100"
            >
              ?
            </button>
          </div>

          {/* JQL Help */}
          {showJqlHelp && (
            <div className="mt-3 p-3 bg-neutral-50 rounded text-xs text-neutral-600 space-y-2">
              <p className="font-medium text-neutral-700">JQL Query Syntax</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="font-mono text-neutral-800">status:todo</p>
                  <p>Match task status</p>
                </div>
                <div>
                  <p className="font-mono text-neutral-800">#work</p>
                  <p>Match label by name</p>
                </div>
                <div>
                  <p className="font-mono text-neutral-800">priority:urgent</p>
                  <p>Match priority</p>
                </div>
                <div>
                  <p className="font-mono text-neutral-800">blocked:true</p>
                  <p>Match blocked tasks</p>
                </div>
                <div>
                  <p className="font-mono text-neutral-800">assignee:john</p>
                  <p>Match assigned user</p>
                </div>
                <div>
                  <p className="font-mono text-neutral-800">due:&gt;2024-01-01</p>
                  <p>Date comparison</p>
                </div>
              </div>
              <p className="pt-2 border-t border-neutral-200">
                Combine with <span className="font-mono">AND</span>, <span className="font-mono">OR</span>, <span className="font-mono">NOT</span> and <span className="font-mono">( )</span> for grouping.
              </p>
              <p>
                <span className="font-mono">status:todo AND (priority:urgent OR #critical)</span>
              </p>
              <p>
                <span className="font-mono">NOT status:done #work</span>
              </p>
            </div>
          )}

          {/* JQL parse errors */}
          {jqlQuery && parseJQL(jqlQuery).errors.length > 0 && (
            <p className="text-xs text-red-500 mt-1">
              {parseJQL(jqlQuery).errors[0]}
            </p>
          )}

          {/* Quick field suggestions */}
          {!jqlQuery && (
            <div className="flex flex-wrap gap-1 mt-2">
              {JQL_FIELDS.slice(0, 6).map(field => (
                <button
                  key={field}
                  onClick={() => setJqlQuery(`${field}:`)}
                  className="text-xs px-2 py-0.5 bg-neutral-100 rounded hover:bg-neutral-200 text-neutral-600"
                >
                  {field}:
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <FilterPanel
          type="task"
          selectedFilterId={selectedFilterId}
          setSelectedFilterId={setSelectedFilterId}
          newFilterName={newFilterName}
          setNewFilterName={setNewFilterName}
          onCreateFilter={handleCreateFilter}
        />
      )}

      {/* Tasks list */}
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Active Tasks */}
        <div>
          {activeTasks.length === 0 && checkedOutTasks.length === 0 ? (
            <div className="text-center py-16">
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
  );
};