import React, { useState } from 'react';
import { Task, RepeatInterval } from '../../types';
import { useApp } from '../../context/AppContext';
import { User, Trash2, Menu, X, CalendarDays, Flag, Tag } from 'lucide-react';
import { LabelBadge } from './LabelBadge';

interface CompactTaskCardProps {
  task: Task;
  showCheckbox?: boolean;
}

type TaskEditor = 'labels' | 'assignee' | 'schedule' | 'flag' | null;

export const CompactTaskCard = ({ task, showCheckbox = true }: CompactTaskCardProps) => {
  const { updateTask, deleteTask, labels, users } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [activeEditor, setActiveEditor] = useState<TaskEditor>(null);

  const handleToggleComplete = () => {
    if (task.status === 'done') {
      updateTask(task.id, { status: 'todo', completedAt: undefined });
    } else {
      updateTask(task.id, { status: 'done', completedAt: Date.now() });
    }
  };

  const dateValue = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';

  return (
    <div className={`rounded-lg bg-white border border-neutral-200 transition-colors ${task.status === 'done' ? 'opacity-50' : 'hover:border-neutral-300'}`}>
      <div className="flex items-start gap-2 p-2.5">
        {/* Layer 1: checkbox + description + hamburger */}
        {showCheckbox && (
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={handleToggleComplete}
            className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-blue-600 accent-blue-600 flex-shrink-0 self-start cursor-pointer"
          />
        )}

        <div className="flex-1 min-w-0">
          <span className={`text-sm leading-5 ${task.status === 'done' ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
            {task.title}
          </span>

          {/* Layer 2 */}
          {showMenu && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveEditor(activeEditor === 'labels' ? null : 'labels')}
                  className={`p-1.5 rounded transition-colors ${activeEditor === 'labels' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="#label"
                  aria-label="Edit labels"
                >
                  <Tag className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'assignee' ? null : 'assignee')}
                  className={`p-1.5 rounded transition-colors ${activeEditor === 'assignee' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="@assignee"
                  aria-label="Edit assignee"
                >
                  <User className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'schedule' ? null : 'schedule')}
                  className={`p-1.5 rounded transition-colors ${activeEditor === 'schedule' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="//due date / recurring"
                  aria-label="Edit due date and recurring"
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'flag' ? null : 'flag')}
                  className={`p-1.5 rounded transition-colors ${activeEditor === 'flag' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title="flag"
                  aria-label="Edit flag"
                >
                  <Flag className="w-4 h-4" />
                </button>

                <div className="ml-auto">
                  <button
                    onClick={() => {
                      deleteTask(task.id);
                      setShowMenu(false);
                      setActiveEditor(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Layer 3 */}
              {activeEditor === 'labels' && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {labels.map((label) => (
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
              )}

              {activeEditor === 'assignee' && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => updateTask(task.id, { assignedTo: task.assignedTo === u.id ? undefined : u.id })}
                      className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${task.assignedTo === u.id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 hover:bg-neutral-200'}`}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              )}

              {activeEditor === 'schedule' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dateValue}
                    onChange={(e) => updateTask(task.id, { dueDate: e.target.value ? new Date(`${e.target.value}T00:00:00`).getTime() : undefined })}
                    className="text-xs px-2 py-1 border border-neutral-200 rounded"
                    aria-label="Due date"
                  />
                  <select
                    value={task.repeatInterval || ''}
                    onChange={(e) => updateTask(task.id, { repeatInterval: (e.target.value || undefined) as RepeatInterval | undefined })}
                    className="text-xs px-2 py-1 border border-neutral-200 rounded"
                    aria-label="Recurring interval"
                  >
                    <option value="">No repeat</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              )}

              {activeEditor === 'flag' && (
                <div className="mt-2">
                  <button
                    onClick={() => updateTask(task.id, { flag: !task.flag })}
                    className={`text-xs px-2 py-1 rounded ${task.flag ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-700'}`}
                  >
                    {task.flag ? 'Flagged' : 'Set flag'}
                  </button>
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
          }}
          className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0 self-start"
          aria-label="Open task menu"
        >
          {showMenu ? <X className="w-4 h-4 text-neutral-600" /> : <Menu className="w-4 h-4 text-neutral-400" />}
        </button>
      </div>
    </div>
  );
};
