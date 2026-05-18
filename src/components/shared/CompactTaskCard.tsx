import React, { useEffect, useState, useRef } from 'react';
import { Task, RepeatInterval } from '../../types';
import { useApp } from '../../context/AppContext';
import { User, Trash2, Menu, X, CalendarDays, Flag, Tag } from 'lucide-react';
import { LabelBadge } from './LabelBadge';

interface CompactTaskCardProps {
  task: Task;
  showCheckbox?: boolean;
}

type TaskEditor = 'labels' | 'assignee' | 'schedule' | null;

export const CompactTaskCard = ({ task, showCheckbox = true }: CompactTaskCardProps) => {
  const { updateTask, deleteTask, labels, users, addLabel } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [activeEditor, setActiveEditor] = useState<TaskEditor>(null);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [labelInput, setLabelInput] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleToggleComplete = () => {
    if (task.status === 'done') {
      updateTask(task.id, { status: 'todo', completedAt: undefined });
    } else {
      updateTask(task.id, { status: 'done', completedAt: Date.now() });
    }
  };

  const dateValue = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';
  const timeValue = task.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : '';

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    if (showMenu && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.setSelectionRange(titleDraft.length, titleDraft.length);
    }
  }, [showMenu]);

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (next && next !== task.title) updateTask(task.id, { title: next });
  };

  const visibleLabels = labels.filter((label) =>
    label.name.toLowerCase().includes(labelInput.trim().toLowerCase())
  );

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(assigneeSearch.toLowerCase())
  );

  const assignedUser = task.assignedTo ? users.find((u) => u.id === task.assignedTo) : null;

  return (
    <div className={`rounded-lg border transition-colors ${
      task.flag || task.blocked
        ? 'bg-red-50 border-red-200'
        : 'bg-white border-neutral-200'
    } ${task.status === 'done' ? 'opacity-50' : 'hover:border-neutral-300'}`}>
      <div className="flex items-start gap-2 p-2.5">
        {/* Layer 1: checkbox + description (editable when menu open) + hamburger */}
        {showCheckbox && (
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={handleToggleComplete}
            className="w-[18px] h-[18px] rounded border-neutral-300 text-blue-600 accent-blue-600 flex-shrink-0 cursor-pointer mt-1"
          />
        )}

        <div className="flex-1 min-w-0">
          {showMenu ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitTitle();
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              className="w-full text-sm leading-6 px-2.5 py-1.5 border border-neutral-400 rounded-md focus:outline-none focus:border-neutral-900"
              aria-label="Edit task title"
            />
          ) : (
            <span className={`text-sm leading-6 block ${task.status === 'done' ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
              {task.title}
            </span>
          )}
          {/* Label feed — toon alle labels als badges */}
          {task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {task.labels.map((labelId) => {
                const label = labels.find((l) => l.id === labelId);
                return label ? <LabelBadge key={label.id} label={label} size="sm" /> : null;
              })}
            </div>
          )}
          {/* Assignee chip */}
          {assignedUser && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="chip bg-blue-50 text-blue-700 font-medium border border-blue-200">
                <User className="w-3 h-3" strokeWidth={2} />
                {assignedUser.name}
              </span>
            </div>
          )}

          {/* Layer 2 */}
          {showMenu && (
            <div className="mt-2 pt-2 border-t border-neutral-100">

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveEditor(activeEditor === 'labels' ? null : 'labels')}
                  className={`p-1.5 rounded transition-colors border border-neutral-200 ${activeEditor === 'labels' ? 'bg-neutral-900 text-white border-neutral-900' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="#label"
                  aria-label="Edit labels"
                >
                  <Tag className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => {
                    const next = activeEditor === 'assignee' ? null : 'assignee';
                    setActiveEditor(next);
                    if (next) setAssigneeSearch(assignedUser?.name || '');
                  }}
                  className={`p-1.5 rounded transition-colors border border-neutral-200 ${activeEditor === 'assignee' ? 'bg-neutral-900 text-white border-neutral-900' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="@assignee"
                  aria-label="Edit assignee"
                >
                  <User className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'schedule' ? null : 'schedule')}
                  className={`p-1.5 rounded transition-colors border border-neutral-200 ${activeEditor === 'schedule' ? 'bg-neutral-900 text-white border-neutral-900' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="//due date / recurring"
                  aria-label="Edit due date and recurring"
                >
                  <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => updateTask(task.id, { flag: !task.flag, blocked: !task.flag })}
                  className={`p-1.5 rounded transition-colors border ${task.flag ? 'bg-red-200 text-red-700 border-red-300' : 'border-neutral-200 hover:bg-neutral-100 text-neutral-500'}`}
                  title="flag"
                  aria-label="Toggle flag"
                >
                  <Flag className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => {
                    deleteTask(task.id);
                    setShowMenu(false);
                    setActiveEditor(null);
                  }}
                  className="p-1.5 rounded transition-colors border border-neutral-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  title="delete"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              {/* Layer 3: Label editor */}
              {activeEditor === 'labels' && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const name = labelInput.trim();
                        if (!name) return;
                        const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
                        const label = existing || addLabel({ name, color: '#3b82f6' });
                        if (!task.labels.includes(label.id)) {
                          updateTask(task.id, { labels: [...task.labels, label.id] });
                        }
                        setLabelInput('');
                      }
                    }}
                    placeholder="Type label and press Enter..."
                    className="w-full text-sm leading-6 px-2.5 py-2 border border-neutral-200 rounded-md"
                    aria-label="Label input"
                  />
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
                        className={task.labels.includes(label.id) ? 'ring-1 ring-neutral-900 rounded' : ''}
                      >
                        <LabelBadge label={label} size="sm" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Layer 3: Assignee — text input filtered to users */}
              {activeEditor === 'assignee' && (
                <div className="mt-2 relative">
                  <input
                    type="text"
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredUsers.length === 1) {
                        updateTask(task.id, { assignedTo: filteredUsers[0].id });
                        setActiveEditor(null);
                      }
                      if (e.key === 'Escape') {
                        setActiveEditor(null);
                      }
                    }}
                    placeholder="Search team members..."
                    className="w-full text-sm leading-6 px-2.5 py-2 border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-500"
                    aria-label="Search assignee"
                  />
                  {assigneeSearch !== undefined && filteredUsers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            updateTask(task.id, { assignedTo: u.id });
                            setAssigneeSearch(u.name);
                            setActiveEditor(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 flex items-center gap-2 ${
                            task.assignedTo === u.id ? 'bg-neutral-50 font-medium' : ''
                          }`}
                        >
                          <User className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span>{u.name}</span>
                          {u.role && <span className="text-xs text-neutral-400 ml-auto">{u.role}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {task.assignedTo && (
                    <button
                      onClick={() => {
                        updateTask(task.id, { assignedTo: undefined });
                        setAssigneeSearch('');
                      }}
                      className="mt-1 text-xs text-neutral-400 hover:text-red-500"
                    >
                      Clear assignee
                    </button>
                  )}
                </div>
              )}

              {/* Layer 3: Schedule — date, time, repeat naast elkaar */}
              {activeEditor === 'schedule' && (
                <div className="mt-2 grid grid-cols-3 gap-2">
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
                    className="text-sm px-2 py-2 border border-neutral-200 rounded"
                    aria-label="Due date"
                  />
                  <input
                    type="time"
                    value={timeValue}
                    onChange={(e) => {
                      if (!dateValue) return;
                      updateTask(task.id, { dueDate: new Date(`${dateValue}T${e.target.value || '00:00'}:00`).getTime() });
                    }}
                    className="text-sm px-2 py-2 border border-neutral-200 rounded"
                    aria-label="Due time"
                  />
                  <select
                    value={task.repeatInterval || ''}
                    onChange={(e) => updateTask(task.id, { repeatInterval: (e.target.value || undefined) as RepeatInterval | undefined })}
                    className="text-sm px-2 py-2 border border-neutral-200 rounded"
                    aria-label="Recurring interval"
                  >
                    <option value="">No repeat</option>
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              )}

            </div>
          )}
        </div>

        <button
          onClick={() => {
            const next = !showMenu;
            setShowMenu(next);
            setActiveEditor(next ? activeEditor : null);
            if (!next) commitTitle();
          }}
          className="p-2 border border-neutral-200 hover:bg-neutral-100 rounded-md transition-colors flex-shrink-0 mt-0.5"
          aria-label="Open task attributes"
        >
          {showMenu ? <X className="w-[18px] h-[18px] text-neutral-600" strokeWidth={1.75} /> : <Menu className="w-[18px] h-[18px] text-neutral-500" strokeWidth={1.75} />}
        </button>
      </div>
    </div>
  );
};
