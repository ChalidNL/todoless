import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task, RepeatInterval, userDisplayName } from '../../types';
import { useApp } from '../../context/AppContext';
import { Check, Menu, X, Trash2, Tag, User, CalendarDays, Flag, ToggleLeft, RotateCcw, ListChecks } from 'lucide-react';
import { AttributeChip } from './AttributeChip';
import { entityColor } from '../../lib/entity-colors';

interface CompactTaskCardProps {
  task: Task;
  showCheckbox?: boolean;
}

type TaskEditor = 'labels' | 'assignee' | 'schedule' | null;

const DeleteConfirm = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
    <div className="bg-white rounded-lg shadow-xl p-5 mx-4 max-w-xs w-full">
      <p className="text-sm font-medium text-neutral-900 mb-4">Weet je het zeker?</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
        >
          Nee
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
        >
          Ja, verwijderen
        </button>
      </div>
    </div>
  </div>
);

const ConfirmDialog = ({ title, confirmLabel, onConfirm, onCancel }: { title: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
    <div className="bg-white rounded-lg shadow-xl p-5 mx-4 max-w-xs w-full">
      <p className="text-sm font-medium text-neutral-900 mb-4">{title}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
        >
          Annuleren
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
        >
          {confirmLabel || 'Bevestigen'}
        </button>
      </div>
    </div>
  </div>
);

export const CompactTaskCard = ({ task, showCheckbox = true }: CompactTaskCardProps) => {
  const { updateTask, deleteTask, labels, users, shops, tasks, addLabel, convertTaskToItem, toggleChipFilter, isChipFilterActive } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [activeEditor, setActiveEditor] = useState<TaskEditor>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [isDeleteHover, setIsDeleteHover] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);

  // Edit mode inactivity timeout (60s)
  const lastInteractionRef = useRef(Date.now());
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const interval = setInterval(() => {
      if (Date.now() - lastInteractionRef.current > 60_000) {
        setShowMenu(false);
        setActiveEditor(null);
      }
    }, 1_000);
    return () => clearInterval(interval);
  }, [showMenu]);

  const trackInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  const isDone = task.status === 'done';
  const assignedUser = task.assignedTo ? users.find((u) => u.id === task.assignedTo) : null;
  const isFlagged = task.flag && !isDone;
  const isOverdue = !!task.dueDate && task.dueDate < Date.now() && !isDone;
  const dateStr = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' })
    : null;

  const repeatLabel = task.repeatInterval
    ? { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[task.repeatInterval]
    : null;

  // Subtasks: tasks that have this task's id in their linkedTo/linkedType (subtask relationship)
  const subtasks = (task.subtaskIds || [])
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as Task[];
  const subtaskCount = subtasks.length;

  const handleToggle = () => {
    if (task.status === 'done') {
      updateTask(task.id, { status: 'todo', completedAt: undefined });
    } else {
      updateTask(task.id, { status: 'done', completedAt: Date.now() });
    }
  };

  const commitAssignee = (id: string | undefined) => {
    updateTask(task.id, { assignedTo: id });
    setActiveEditor(null);
  };

  // --- Clear functions — all use explicit null / [] (PB ignores undefined) ---
  const clearAssignee = () => {
    updateTask(task.id, { assignedTo: null });
    setAssigneeSearch('');
    setActiveEditor(null);
  };

  const clearAllSchedule = () => {
    updateTask(task.id, { dueDate: null, repeatInterval: null });
  };

  const clearAllLabels = () => {
    updateTask(task.id, { labels: [] });
  };

  const removeLabel = (labelId: string) => {
    updateTask(task.id, {
      labels: task.labels.filter((id) => id !== labelId),
    });
  };

  const handleConvertConfirm = () => {
    setShowConvertConfirm(false);
    convertTaskToItem(task.id);
    setShowMenu(false);
    setActiveEditor(null);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteTask(task.id);
    setShowMenu(false);
    setActiveEditor(null);
  };

  const dateValue = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';
  const timeValue = task.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '';
  const filteredUsers = users.filter((u) =>
    userDisplayName(u).toLowerCase().includes(assigneeSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(assigneeSearch.toLowerCase())
  );
  const visibleLabels = labels.filter((l) =>
    l.name.toLowerCase().includes(labelInput.trim().toLowerCase())
  );
  const hasLabels = task.labels.length > 0;
  const hasAssignee = !!task.assignedTo;
  const hasSchedule = !!task.dueDate || !!task.repeatInterval;

  const isLabelFiltered = (id: string) => isChipFilterActive('label', id);
  const isAssigneeFiltered = (id?: string) => id ? isChipFilterActive('assignee', id) : false;
  const isDateFiltered = (ds: string) => isChipFilterActive('date', ds);
  const isRepeatFiltered = (rl: string) => isChipFilterActive('repeat', rl);

  const openEditor = (editor: TaskEditor) => {
    setShowMenu(true);
    setActiveEditor(editor);
  };

  return (
    <>
      <div
        ref={cardRef}
        onClick={trackInteraction}
        className={`rounded-lg border transition-colors ${
        isDone ? 'border-neutral-200 opacity-75' : 'border-neutral-200 hover:border-neutral-300'
      } ${
        isFlagged ? 'border-red-300 !bg-red-50' : isOverdue ? '!bg-orange-50' : 'bg-white'
      } ${showMenu ? 'ring-1 ring-neutral-300 !bg-neutral-50' : ''}`}>
        <div className="p-2.5">
          {/* Line 1: checkbox + title + hamburger */}
          <div className="flex items-center gap-2">
            {showCheckbox && (
              <button
                onClick={handleToggle}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isDone
                    ? 'bg-neutral-900 border-neutral-900 text-white'
                    : 'border-neutral-300 hover:border-neutral-500'
                }`}
                aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
              >
                {isDone && <Check className="w-3 h-3" />}
              </button>
            )}

            {showMenu ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = titleDraft.trim();
                  if (trimmed && trimmed !== task.title) {
                    updateTask(task.id, { title: trimmed });
                  } else if (!trimmed) {
                    setTitleDraft(task.title);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === 'Escape') {
                    setTitleDraft(task.title);
                  }
                }}
                autoFocus
                className={`text-sm font-medium flex-1 min-w-0 px-1.5 py-0.5 border border-neutral-300 rounded bg-white ${
                  isDone ? 'line-through text-neutral-400' : isFlagged ? 'text-red-900' : 'text-neutral-900'
                }`}
                aria-label="Edit task title"
              />
            ) : (
            <span className={`text-sm font-medium flex-1 truncate ${
              isDone ? 'line-through text-neutral-400' : isFlagged ? 'text-red-900' : 'text-neutral-900'
            }`}>
              {task.title}
            </span>
            )}

            {/* Hamburger */}
            <button
              onClick={() => {
                const next = !showMenu;
                setShowMenu(next);
                setActiveEditor(next ? activeEditor : null);
                if (next) setTitleDraft(task.title);
              }}
              className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
              aria-label="Open task attributes"
            >
              {showMenu 
                ? <X className="w-4 h-4 text-neutral-600 transition-transform duration-200" /> 
                : <Menu className="w-4 h-4 text-neutral-400 transition-transform duration-200" />
              }
            </button>
          </div>

          {/* Line 2: chips — labels, assignee, date, repeat, subtasks (no X on chips) */}
          {(hasLabels || assignedUser || (dateStr && !isDone) || (repeatLabel && !isDone) || subtaskCount > 0) && !isDone && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5 ml-0.5">
              {task.labels.map((labelId) => {
                const label = labels.find((l) => l.id === labelId);
                return label ? (
                  <AttributeChip
                    key={label.id}
                    icon={<Tag className="w-3.5 h-3.5" />}
                    label={label.name}
                    color="#3b82f6"
                    active={isLabelFiltered(label.id)}
                    onClick={showMenu ? () => removeLabel(label.id) : undefined}
                  />
                ) : null;
              })}
              {assignedUser && (
                  <AttributeChip
                    icon={<User className="w-3.5 h-3.5" />}
                    label={assignedUser.firstName || ''}
                  color="#10b981"
                  active={isAssigneeFiltered(assignedUser.id)}
                  onClick={showMenu ? clearAssignee : undefined}
                />
              )}
              {dateStr && !isDone && (
                <AttributeChip
                  icon={<CalendarDays className="w-3.5 h-3.5" />}
                  label={dateStr}
                  color="#ea580c"
                  active={isDateFiltered(dateStr)}
                  onClick={showMenu ? clearAllSchedule : undefined}
                />
              )}
              {repeatLabel && !isDone && (
                <AttributeChip
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  label={repeatLabel}
                  color="#ea580c"
                  active={isRepeatFiltered(repeatLabel)}
                  onClick={showMenu ? clearAllSchedule : undefined}
                />
              )}
              {subtaskCount > 0 && (
                <AttributeChip
                  icon={<ListChecks className="w-3.5 h-3.5" />}
                  label={`${subtaskCount}`}
                  color="#8b5cf6"
                  onClick={() => setSubtasksExpanded(!subtasksExpanded)}
                />
              )}
            </div>
          )}

          {/* Expanded subtasks */}
          {subtasksExpanded && subtaskCount > 0 && (
            <div className="mt-2 pt-2 border-t border-neutral-100 space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-neutral-500">Subtasks ({subtaskCount})</span>
                <button
                  onClick={() => setSubtasksExpanded(false)}
                  className="p-0.5 hover:bg-neutral-100 rounded"
                  aria-label="Collapse subtasks"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
                </button>
              </div>
              {subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 pl-2 py-1 bg-neutral-50 rounded border border-neutral-100">
                  <button
                    onClick={() => {
                      if (subtask.status === 'done') {
                        updateTask(subtask.id, { status: 'todo', completedAt: undefined });
                      } else {
                        updateTask(subtask.id, { status: 'done', completedAt: Date.now() });
                      }
                    }}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      subtask.status === 'done'
                        ? 'bg-neutral-900 border-neutral-900 text-white'
                        : 'border-neutral-300 hover:border-neutral-500'
                    }`}
                    aria-label={subtask.status === 'done' ? 'Mark subtask as not done' : 'Mark subtask as done'}
                  >
                    {subtask.status === 'done' && <Check className="w-2.5 h-2.5" />}
                  </button>
                  <span className={`text-xs flex-1 truncate ${subtask.status === 'done' ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>
                    {subtask.title}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Line 3: attributes behind hamburger — smooth expand/collapse animation */}
          <div style={{ display: 'grid', gridTemplateRows: showMenu ? '1fr' : '0fr' }} className="mt-2 pt-2 border-t border-neutral-100 overflow-hidden transition-all duration-300 ease-out">
            <div>
              {/* Attribute buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveEditor(activeEditor === 'labels' ? null : 'labels')}
                  className={`p-1.5 rounded transition-colors ${
                    hasLabels || activeEditor === 'labels'
                      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title="#label"
                  aria-label="Edit labels"
                >
                  <Tag className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => {
                    const next = activeEditor === 'assignee' ? null : 'assignee';
                    setActiveEditor(next);
                    if (next) setAssigneeSearch('');
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    hasAssignee || activeEditor === 'assignee'
                      ? 'bg-green-100 text-green-700'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title="@assignee"
                  aria-label="Edit assignee"
                >
                  <User className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'schedule' ? null : 'schedule')}
                  className={`p-1.5 rounded transition-colors ${
                    hasSchedule || activeEditor === 'schedule'
                      ? 'bg-orange-100 text-orange-700'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title="//schedule"
                  aria-label="Edit schedule"
                >
                  <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => updateTask(task.id, { flag: !task.flag, blocked: !task.flag })}
                  className={`p-1.5 rounded transition-colors ${task.flag ? 'bg-red-100 text-red-700' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="flag"
                  aria-label="Toggle flag"
                >
                  <Flag className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setShowConvertConfirm(true)}
                  className="p-1.5 rounded transition-colors hover:bg-neutral-100 text-neutral-400"
                  title="convert to grocery"
                  aria-label="Convert to grocery item"
                >
                  <ToggleLeft className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  onMouseEnter={() => setIsDeleteHover(true)}
                  onMouseLeave={() => setIsDeleteHover(false)}
                  className={`p-1.5 rounded transition-colors ${isDeleteHover ? 'bg-red-100 text-red-700' : 'text-red-600 hover:bg-red-50'}`}
                  title="delete"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              {/* Label editor */}
              {activeEditor === 'labels' && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const name = labelInput.trim();
                          if (!name) return;
                          const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
                          if (existing) {
                            if (!task.labels.includes(existing.id)) {
                              updateTask(task.id, { labels: [...task.labels, existing.id] });
                            }
                          } else {
                            addLabel({ name, color: '#3b82f6' });
                          }
                          setLabelInput('');
                        }
                      }}
                      placeholder="Type + Enter..."
                      className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label="Label input"
                    />
                    {hasLabels && (
                      <button
                        onClick={clearAllLabels}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded text-sm"
                        aria-label="Clear all labels"
                        title="Clear all labels"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {visibleLabels.map((label) => (
                      <button
                        key={label.id}
                        onClick={() => {
                          const has = task.labels.includes(label.id);
                          updateTask(task.id, {
                            labels: has ? task.labels.filter((id) => id !== label.id) : [...task.labels, label.id],
                          });
                        }}
                      >
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-xs font-normal leading-none border ${
                            task.labels.includes(label.id)
                              ? 'ring-2 ring-neutral-900'
                              : 'hover:border-neutral-400'
                          }`}
                          style={{
                            backgroundColor: task.labels.includes(label.id) ? `${label.color}20` : undefined,
                            color: task.labels.includes(label.id) ? label.color : undefined,
                            borderColor: task.labels.includes(label.id) ? `${label.color}40` : '#e5e7eb',
                          }}
                        >
                          {label.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignee editor — X uses clearAssignee (null, same pattern as label) */}
              {activeEditor === 'assignee' && (
                <div className="mt-2 relative">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && filteredUsers.length === 1) {
                          commitAssignee(filteredUsers[0].id);
                        }
                        if (e.key === 'Escape') setActiveEditor(null);
                      }}
                      placeholder="Search team..."
                      className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label="Search assignee"
                    />
                    {hasAssignee && (
                      <button
                        onClick={clearAssignee}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded text-sm"
                        aria-label="Clear assignee"
                        title="Remove assignee"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {assigneeSearch !== undefined && filteredUsers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            const val = task.assignedTo === u.id ? null : u.id;
                            commitAssignee(val);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 flex items-center gap-2 ${
                            task.assignedTo === u.id ? 'bg-neutral-50 font-medium' : ''
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0"
                            style={{ backgroundColor: entityColor(u.id) }}
                          >
                            {userDisplayName(u).charAt(0).toUpperCase()}
                          </span>
                          <span>{userDisplayName(u)}</span>
                          {u.role && <span className="text-xs text-neutral-400 ml-auto">{u.role}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Schedule editor — X uses clearAllSchedule (null, same pattern as label) */}
              {activeEditor === 'schedule' && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateValue}
                      onChange={(e) => {
                        if (!e.target.value) {
                          updateTask(task.id, { dueDate: null });
                          return;
                        }
                        const t = timeValue || '00:00';
                        updateTask(task.id, { dueDate: new Date(`${e.target.value}T${t}:00`).getTime() });
                      }}
                      className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label="Due date"
                    />
                    <input
                      type="time"
                      value={timeValue}
                      onChange={(e) => {
                        if (!dateValue) return;
                        updateTask(task.id, { dueDate: new Date(`${dateValue}T${e.target.value || '00:00'}:00`).getTime() });
                      }}
                      className="text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label="Due time"
                    />
                    <select
                      value={task.repeatInterval || ''}
                      onChange={(e) => updateTask(task.id, { repeatInterval: (e.target.value || null) as RepeatInterval | null })}
                      className="text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label="Recurring interval"
                    >
                      <option value="">No repeat</option>
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showConvertConfirm && (
        <ConfirmDialog
          title="Taak omzetten naar boodschap?"
          confirmLabel="Ja, omzetten"
          onConfirm={handleConvertConfirm}
          onCancel={() => setShowConvertConfirm(false)}
        />
      )}
    </>
  );
};
