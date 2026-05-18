import React, { useState } from 'react';
import { Task, RepeatInterval } from '../../types';
import { useApp } from '../../context/AppContext';
import { Check, Menu, X, Trash2, Tag, User, CalendarDays, Flag, ToggleLeft, RotateCcw } from 'lucide-react';
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

export const CompactTaskCard = ({ task, showCheckbox = true }: CompactTaskCardProps) => {
  const { updateTask, deleteTask, labels, users, shops, addLabel, convertTaskToItem, toggleChipFilter, isChipFilterActive } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [activeEditor, setActiveEditor] = useState<TaskEditor>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Allow distinguishing between hover-click and chip-filter click
  const [isDeleteHover, setIsDeleteHover] = useState(false);

  const isDone = task.status === 'done';
  const assignedUser = task.assignedTo ? users.find((u) => u.id === task.assignedTo) : null;
  const isFlagged = task.flag && !isDone;
  const dateStr = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('nl-NL', { month: 'short', day: 'numeric' })
    : null;

  const repeatLabel = task.repeatInterval
    ? { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[task.repeatInterval]
    : null;

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

  const clearAssignee = () => {
    updateTask(task.id, { assignedTo: undefined });
    setAssigneeSearch('');
    setActiveEditor(null);
  };

  const clearAllSchedule = () => {
    updateTask(task.id, { dueDate: undefined, repeatInterval: undefined });
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
    u.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(assigneeSearch.toLowerCase())
  );
  const visibleLabels = labels.filter((l) =>
    l.name.toLowerCase().includes(labelInput.trim().toLowerCase())
  );
  const hasLabels = task.labels.length > 0;
  const hasAssignee = !!task.assignedTo;
  const hasSchedule = !!task.dueDate || !!task.repeatInterval;

  // Check which chips are active filters
  const isLabelFiltered = (id: string) => isChipFilterActive('label', id);
  const isAssigneeFiltered = (id?: string) => id ? isChipFilterActive('assignee', id) : false;
  const isDateFiltered = (ds: string) => isChipFilterActive('date', ds);
  const isRepeatFiltered = (rl: string) => isChipFilterActive('repeat', rl);

  return (
    <>
      <div className={`rounded-lg border transition-colors ${
        isDone ? 'border-neutral-200 opacity-75' : 'border-neutral-200 hover:border-neutral-300'
      } ${
        isFlagged ? 'border-red-300 !bg-red-50' : 'bg-white'
      }`}>
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

            <span className={`text-sm font-medium flex-1 truncate ${
              isDone ? 'line-through text-neutral-400' : isFlagged ? 'text-red-900' : 'text-neutral-900'
            }`}>
              {task.title}
            </span>

            {/* Hamburger */}
            <button
              onClick={() => {
                setShowMenu(!showMenu);
                setActiveEditor(!showMenu ? activeEditor : null);
              }}
              className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
              aria-label="Open task attributes"
            >
              {showMenu ? <X className="w-4 h-4 text-neutral-600" /> : <Menu className="w-4 h-4 text-neutral-400" />}
            </button>
          </div>

          {/* Line 2: chips — flag, labels, assignee, date, repeat */}
          {(isFlagged || hasLabels || assignedUser || (dateStr && !isDone) || (repeatLabel && !isDone)) && !isDone && (
            <div className="flex flex-wrap items-center gap-1 mt-1.5 ml-0.5">
              {isFlagged && (
                <span className="inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-xs font-normal leading-none border border-red-300 bg-red-100 text-red-700">
                  <Flag className="w-3.5 h-3.5" />
                  Flagged
                </span>
              )}
              {task.labels.map((labelId) => {
                const label = labels.find((l) => l.id === labelId);
                return label ? (
                  <AttributeChip
                    key={label.id}
                    icon={<Tag className="w-3.5 h-3.5" />}
                    label={label.name}
                    color={label.color}
                    active={isLabelFiltered(label.id)}
                    onClick={() => toggleChipFilter('label', label.id, label.name, label.color)}
                    onRemove={(e) => {
                      e.stopPropagation();
                      updateTask(task.id, {
                        labels: task.labels.filter((id) => id !== label.id),
                      });
                    }}
                  />
                ) : null;
              })}
              {assignedUser && (
                <AttributeChip
                  icon={<User className="w-3.5 h-3.5" />}
                  label={assignedUser.name}
                  color={entityColor(assignedUser.id)}
                  active={isAssigneeFiltered(assignedUser.id)}
                  onClick={() => assignedUser ? toggleChipFilter('assignee', assignedUser.id, assignedUser.name, entityColor(assignedUser.id)) : undefined}
                  onRemove={() => updateTask(task.id, { assignedTo: undefined })}
                />
              )}
              {dateStr && !isDone && (
                <AttributeChip icon={<CalendarDays className="w-3.5 h-3.5" />} label={dateStr} color="#6b7280" active={isDateFiltered(dateStr)} onClick={() => toggleChipFilter('date', dateStr)} />
              )}
              {repeatLabel && !isDone && (
                <AttributeChip icon={<RotateCcw className="w-3.5 h-3.5" />} label={repeatLabel} color="#6b7280" active={isRepeatFiltered(repeatLabel)} onClick={() => toggleChipFilter('repeat', repeatLabel)} />
              )}
            </div>
          )}

          {/* Line 3: attributes behind hamburger */}
          {showMenu && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              {/* Attribute buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveEditor(activeEditor === 'labels' ? null : 'labels')}
                  className={`p-1.5 rounded transition-colors ${
                    hasLabels || activeEditor === 'labels'
                      ? 'bg-neutral-900 text-white'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title="#label"
                  aria-label="Edit labels"
                >
                  <Tag className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => {
                    // Clicking assignee icon with assignee set -> clear it
                    if (task.assignedTo) {
                      clearAssignee();
                    } else {
                      const next = activeEditor === 'assignee' ? null : 'assignee';
                      setActiveEditor(next);
                      if (next) setAssigneeSearch('');
                    }
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    hasAssignee || activeEditor === 'assignee'
                      ? 'bg-neutral-900 text-white'
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
                      ? 'bg-neutral-900 text-white'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title="//schedule"
                  aria-label="Edit schedule"
                >
                  <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => updateTask(task.id, { flag: !task.flag, blocked: !task.flag })}
                  className={`p-1.5 rounded transition-colors ${task.flag ? 'bg-red-200 text-red-700' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="flag"
                  aria-label="Toggle flag"
                >
                  <Flag className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => {
                    convertTaskToItem(task.id);
                    setShowMenu(false);
                    setActiveEditor(null);
                  }}
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
                  </div>
                  {/* Label options — same size as chips */}
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

              {/* Assignee editor */}
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
                    {task.assignedTo && (
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
                          onClick={() => commitAssignee(task.assignedTo === u.id ? undefined : u.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 flex items-center gap-2 ${
                            task.assignedTo === u.id ? 'bg-neutral-50 font-medium' : ''
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0"
                            style={{ backgroundColor: entityColor(u.id) }}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                          <span>{u.name}</span>
                          {u.role && <span className="text-xs text-neutral-400 ml-auto">{u.role}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Schedule editor */}
              {activeEditor === 'schedule' && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateValue}
                      onChange={(e) => {
                        if (!e.target.value) {
                          updateTask(task.id, { dueDate: undefined });
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
                      onChange={(e) => updateTask(task.id, { repeatInterval: (e.target.value || undefined) as RepeatInterval | undefined })}
                      className="text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label="Recurring interval"
                    >
                      <option value="">No repeat</option>
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                    {hasSchedule && (
                      <button
                        onClick={clearAllSchedule}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                        aria-label="Clear schedule"
                        title="Clear date and repeat"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
};
