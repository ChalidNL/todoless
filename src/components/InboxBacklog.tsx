import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CompactTaskCard } from './shared/CompactTaskCard';
import { NewGlobalHeader } from './shared/NewGlobalHeader';
import { TopBar } from './shared/TopBar';
import { DueDateNotifications } from './shared/DueDateNotifications';
import {
  CheckSquare, Zap, Compass, Flag, X, Lightbulb,
  Inbox, TrendingUp, Clock, AlertCircle, Send,
} from 'lucide-react';
import { Priority, Horizon } from '../types';
import { parseQuickAdd } from '../lib/quick-add-parser';

export const InboxBacklog = () => {
  const { tasks, addTask, updateTask, sprints, currentSprint, createNewSprint } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // Braindump state
  const [braindumpText, setBraindumpText] = useState('');
  const [isBraindumpFocused, setIsBraindumpFocused] = useState(false);
  const braindumpRef = useRef<HTMLTextAreaElement>(null);

  // Per-task quick-add sprint state
  const [sprintMenuId, setSprintMenuId] = useState<string | null>(null);

  const backlogTasks = tasks
    .filter(t => t.status === 'backlog')
    .filter(t => !t.archived)
    .filter(t => searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.createdAt - a.createdAt);

  // Dashboard summary stats
  const backlogCount = backlogTasks.length;
  const todoCount = tasks.filter(t => t.status === 'todo' && !t.archived).length;
  const doneToday = tasks.filter(t => {
    if (!t.completedAt) return false;
    const today = new Date();
    const completed = new Date(t.completedAt);
    return completed.toDateString() === today.toDateString();
  }).length;
  const overdueCount = tasks.filter(t => t.dueDate && t.dueDate < Date.now() && t.status !== 'done').length;

  const handleBraindumpSubmit = () => {
    if (!braindumpText.trim()) return;

    // Split on newlines to support multi-line braindump
    const lines = braindumpText.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const parsed = parseQuickAdd(line);
      addTask({
        title: parsed.title.trim(),
        status: 'backlog',
        priority: 'normal',
        labels: parsed.labels || [],
        assignedTo: parsed.assignee,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate).getTime() : undefined,
        horizon: null,
        sprint: null,
        isPrivate: parsed.isPrivate,
      } as any);
    }
    setBraindumpText('');
  };

  const handleBraindumpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBraindumpSubmit();
    }
  };

  const handleAddTaskWithValue = (value: string, metadata?: { assignee?: string; labels?: string[]; dueDate?: number }) => {
    if (!value.trim()) return;
    addTask({
      title: value.trim(),
      status: 'backlog',
      priority: 'normal',
      labels: metadata?.labels || [],
      assignedTo: metadata?.assignee,
      dueDate: metadata?.dueDate,
      horizon: null,
      sprint: null
    } as any);
  };

  const handleTaskSelect = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleQuickAddToSprint = (taskId: string) => {
    if (!currentSprint) {
      createNewSprint();
    }
    updateTask(taskId, {
      status: 'todo',
      sprintId: currentSprint?.id
    });
    setSprintMenuId(null);
  };

  const handleBulkAssignToSprint = () => {
    if (!currentSprint) {
      createNewSprint();
    }

    selectedTasks.forEach(taskId => {
      updateTask(taskId, {
        status: 'todo',
        sprintId: currentSprint?.id
      });
    });

    setSelectedTasks([]);
    setShowBulkMenu(false);
  };

  const handleBulkSetPriority = (priority: Priority) => {
    selectedTasks.forEach(taskId => {
      updateTask(taskId, { priority });
    });
    setSelectedTasks([]);
    setShowBulkMenu(false);
  };

  const handleBulkSetHorizon = (horizon: Horizon) => {
    selectedTasks.forEach(taskId => {
      updateTask(taskId, { horizon });
    });
    setSelectedTasks([]);
    setShowBulkMenu(false);
  };

  // Close sprint menu when clicking outside
  useEffect(() => {
    const handleClick = () => setSprintMenuId(null);
    if (sprintMenuId) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [sprintMenuId]);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <TopBar />
      <NewGlobalHeader
        onAdd={handleAddTaskWithValue}
        onSearch={setSearchQuery}
        searchPlaceholder="Search inbox..."
      />

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-6">
        {/* Dashboard Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Inbox', value: backlogCount, icon: <Inbox className="w-4 h-4 text-blue-500" />, color: 'blue' },
            { label: 'In Sprint', value: todoCount, icon: <Zap className="w-4 h-4 text-green-500" />, color: 'green' },
            { label: 'Done Today', value: doneToday, icon: <TrendingUp className="w-4 h-4 text-emerald-500" />, color: 'emerald' },
            { label: 'Overdue', value: overdueCount, icon: <AlertCircle className="w-4 h-4 text-red-500" />, color: 'red' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                {stat.icon}
                <span className="text-xs text-neutral-500">{stat.label}</span>
              </div>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Braindump */}
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-sm">Braindump</h2>
            <span className="text-xs text-neutral-400 ml-auto">Enter to add · Shift+Enter for new line</span>
          </div>
          <div className="p-3">
            <textarea
              ref={braindumpRef}
              value={braindumpText}
              onChange={e => setBraindumpText(e.target.value)}
              onKeyDown={handleBraindumpKeyDown}
              onFocus={() => setIsBraindumpFocused(true)}
              onBlur={() => setIsBraindumpFocused(false)}
              placeholder="Dump your thoughts here...&#10;#label @person //tomorrow&#10;One task per line"
              className={`w-full min-h-[100px] p-3 text-sm rounded-lg border transition-colors resize-none bg-neutral-50 focus:bg-white focus:outline-none ${
                isBraindumpFocused
                  ? 'border-blue-400 ring-2 ring-blue-100'
                  : 'border-neutral-200'
              }`}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleBraindumpSubmit}
                disabled={!braindumpText.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Add to Inbox
              </button>
            </div>
          </div>
        </div>

        {/* Backlog list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-neutral-600 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Inbox ({backlogCount})
            </h2>
          </div>

          {backlogTasks.length === 0 ? (
            <div className="text-center py-16">
              <Inbox className="w-12 h-12 text-neutral-200 mx-auto mb-3" />
              <p className="text-neutral-400 text-sm">Inbox is empty</p>
              <p className="text-neutral-300 text-xs mt-1">Use braindump above to capture ideas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {backlogTasks.map((task) => (
                <div
                  key={task.id}
                  className="relative"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input, button, textarea')) return;
                    handleTaskSelect(task.id);
                  }}
                >
                  {/* Selection indicator */}
                  {selectedTasks.includes(task.id) && (
                    <div
                      className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center shadow-md cursor-pointer hover:bg-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTaskSelect(task.id);
                      }}
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  <div className={`${selectedTasks.includes(task.id) ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}>
                    <div className="relative">
                      <CompactTaskCard task={task} showCheckbox={true} />
                      {/* Quick-add to sprint button */}
                      <div className="absolute top-2 right-2 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSprintMenuId(sprintMenuId === task.id ? null : task.id);
                          }}
                          className="p-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors border border-green-200"
                          title="Add to current sprint"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                        {sprintMenuId === task.id && (
                          <div
                            className="absolute right-0 top-8 bg-white rounded-lg shadow-xl border border-neutral-200 p-3 w-56 z-20"
                            onClick={e => e.stopPropagation()}
                          >
                            <p className="text-xs text-neutral-600 mb-2 flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Add to Sprint
                            </p>
                            <button
                              onClick={() => handleQuickAddToSprint(task.id)}
                              className="w-full px-3 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100 border border-green-200 mb-2"
                            >
                              {currentSprint ? currentSprint.name : 'Create & Assign Sprint'}
                            </button>
                            <div className="border-t border-neutral-100 pt-2">
                              <p className="text-xs text-neutral-500 mb-1">Set Horizon</p>
                              <div className="flex gap-1">
                                {(['today', 'week', 'month'] as Horizon[]).map(h => (
                                  <button
                                    key={h}
                                    onClick={() => {
                                      updateTask(task.id, { horizon: h });
                                      setSprintMenuId(null);
                                    }}
                                    className="flex-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 capitalize"
                                  >
                                    {h}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      {selectedTasks.length > 0 && (
        <div className="fixed bottom-20 right-4 z-50">
          {/* Bulk Menu */}
          {showBulkMenu && (
            <div className="mb-4 bg-white rounded-lg shadow-xl border border-neutral-200 p-4 w-64">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Bulk Actions</h3>
                <button
                  onClick={() => setShowBulkMenu(false)}
                  className="p-1 hover:bg-neutral-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sprint */}
              <div className="mb-4">
                <p className="text-xs text-neutral-600 mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Assign to Sprint
                </p>
                <button
                  onClick={handleBulkAssignToSprint}
                  className="w-full px-3 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100 border border-green-200"
                >
                  {currentSprint ? currentSprint.name : 'Create & Assign Sprint'}
                </button>
              </div>

              {/* Horizon */}
              <div className="mb-4">
                <p className="text-xs text-neutral-600 mb-2 flex items-center gap-1">
                  <Compass className="w-3 h-3" />
                  Set Horizon
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleBulkSetHorizon('today' as Horizon)}
                    className="flex-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => handleBulkSetHorizon('week')}
                    className="flex-1 px-2 py-1.5 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                  >
                    Week
                  </button>
                  <button
                    onClick={() => handleBulkSetHorizon('month')}
                    className="flex-1 px-2 py-1.5 text-xs bg-orange-50 text-orange-700 rounded hover:bg-orange-100"
                  >
                    Month
                  </button>
                </div>
              </div>

              {/* Priority */}
              <div>
                <p className="text-xs text-neutral-600 mb-2 flex items-center gap-1">
                  <Flag className="w-3 h-3" />
                  Set Priority
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleBulkSetPriority('urgent')}
                    className="flex-1 px-2 py-1.5 text-xs bg-orange-50 text-orange-700 rounded hover:bg-orange-100"
                  >
                    High
                  </button>
                  <button
                    onClick={() => handleBulkSetPriority('normal')}
                    className="flex-1 px-2 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    Med
                  </button>
                  <button
                    onClick={() => handleBulkSetPriority('low')}
                    className="flex-1 px-2 py-1.5 text-xs bg-neutral-50 text-neutral-700 rounded hover:bg-neutral-100"
                  >
                    Low
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FAB Button */}
          <button
            onClick={() => setShowBulkMenu(!showBulkMenu)}
            className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-all relative"
          >
            {showBulkMenu ? (
              <X className="w-6 h-6" />
            ) : (
              <>
                <CheckSquare className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                  {selectedTasks.length}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      <DueDateNotifications />
    </div>
  );
};
