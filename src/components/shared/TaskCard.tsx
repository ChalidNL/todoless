import React, { useState } from 'react';
import { Task } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Clock, Tag, User, Flag, AlertCircle, Trash2, Zap, Lock, Unlock,
  Menu, X, CalendarDays, Repeat, Eye,
} from 'lucide-react';
import { LabelBadge } from './LabelBadge';

export interface TaskCardProps {
  task: Task;
  showCheckbox?: boolean;
  compact?: boolean;
}

/**
 * TaskCard — default display type: checkbox + description + attributes.
 * Shows task title with completion checkbox, followed by attribute badges
 * (labels, priority, assignee, due date, sprint, privacy, blockers).
 */
export const TaskCard = ({ task, showCheckbox = true, compact = false }: TaskCardProps) => {
  const { updateTask, deleteTask, labels, users, sprints, convertTaskToItem } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showSprintPicker, setShowSprintPicker] = useState(false);
  const [labelQuery, setLabelQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');

  const taskLabels = labels.filter(l => task.labels.includes(l.id));
  const assignee = users.find(u => u.id === task.assignedTo);
  const sprint = sprints.find(s => s.id === task.sprintId);

  const priorityIcon = task.priority === 'urgent'
    ? '🔴'
    : task.priority === 'low'
      ? '🔵'
      : task.priority === 'normal'
        ? '🟡'
        : '';

  const handleToggleComplete = () => {
    if (task.status === 'done') {
      updateTask(task.id, { status: 'todo', completedAt: undefined });
    } else {
      updateTask(task.id, { status: 'done', completedAt: Date.now() });
    }
  };

  const closePickers = () => {
    setShowLabelPicker(false);
    setShowDuePicker(false);
    setShowAssignPicker(false);
    setShowPriorityPicker(false);
    setShowSprintPicker(false);
  };

  const filteredLabels = labels.filter(l =>
    l.name.toLowerCase().includes(labelQuery.toLowerCase())
  );
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userQuery.toLowerCase())
  );

  const toggleLabel = (labelId: string) => {
    const has = task.labels.includes(labelId);
    updateTask(task.id, {
      labels: has
        ? task.labels.filter(id => id !== labelId)
        : [...task.labels, labelId],
    });
  };

  const createLabel = () => {
    if (labelQuery.trim()) {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      const { addLabel } = useApp();
      // We'll call the context method directly
    }
  };

  const dueDateStr = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
    : null;

  const isOverdue = task.dueDate
    ? task.dueDate < Date.now() && task.status !== 'done'
    : false;

  const cardClass = compact
    ? 'rounded-lg p-2 hover:border-neutral-300 transition-all bg-white border border-neutral-200'
    : 'rounded-lg p-3 hover:border-neutral-300 transition-all bg-white border-2 border-neutral-200';

  return (
    <div
      className={`${cardClass} ${task.blocked ? 'bg-red-50 border-red-300' : ''} ${task.status === 'done' ? 'opacity-60' : ''}`}
      data-testid={`task-card-${task.id}`}
    >
      {/* Row 1: Checkbox + Description + Menu */}
      <div className="flex items-start gap-2">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={handleToggleComplete}
            className="w-4 h-4 mt-0.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer flex-shrink-0 accent-blue-600"
            aria-label={`Mark "${task.title}" as ${task.status === 'done' ? 'incomplete' : 'complete'}`}
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Title / Description */}
          <p
            className={`text-sm leading-snug ${task.status === 'done'
              ? 'line-through text-neutral-400'
              : 'text-neutral-900'
              }`}
          >
            {task.title || <span className="italic text-neutral-400">Untitled task</span>}
          </p>

          {/* Attributes row — badges for all set attributes */}
          {!compact && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {/* Labels */}
              {taskLabels.map(label => (
                <LabelBadge key={label.id} label={label} size="sm" />
              ))}

              {/* Priority */}
              {task.priority && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${task.priority === 'urgent'
                    ? 'bg-red-50 text-red-700'
                    : task.priority === 'low'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-yellow-50 text-yellow-700'
                    }`}
                  title={`Priority: ${task.priority}`}
                >
                  <AlertCircle className="w-3 h-3" />
                  {task.priority}
                </span>
              )}

              {/* Due date */}
              {dueDateStr && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${isOverdue
                    ? 'bg-red-50 text-red-700 font-medium'
                    : 'bg-neutral-100 text-neutral-600'
                    }`}
                  title={isOverdue ? 'Overdue' : `Due: ${dueDateStr}`}
                >
                  <CalendarDays className="w-3 h-3" />
                  {dueDateStr}
                  {isOverdue && ' !'}
                </span>
              )}

              {/* Repeat interval */}
              {task.repeatInterval && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-700" title={`Repeats: ${task.repeatInterval}`}>
                  <Repeat className="w-3 h-3" />
                  {task.repeatInterval}
                </span>
              )}

              {/* Assignee */}
              {assignee && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-50 text-green-700" title={`Assigned to: ${assignee.name}`}>
                  <User className="w-3 h-3" />
                  {assignee.name}
                </span>
              )}

              {/* Sprint */}
              {sprint && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700" title={`Sprint: ${sprint.name}`}>
                  <Zap className="w-3 h-3" />
                  {sprint.name}
                </span>
              )}

              {/* Blocker */}
              {task.blocked && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-800 font-medium" title={task.blockedComment || 'Blocked'}>
                  <Flag className="w-3 h-3" />
                  Blocked
                  {task.blockedComment && `: ${task.blockedComment}`}
                </span>
              )}

              {/* Private */}
              {task.isPrivate && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700" title="Private — only visible to you">
                  <Lock className="w-3 h-3" />
                  Private
                </span>
              )}
            </div>
          )}
        </div>

        {/* Menu button */}
        <button
          onClick={() => {
            setShowMenu(!showMenu);
            if (showMenu) closePickers();
          }}
          className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0 mt-0.5"
          aria-label="Task options"
        >
          {showMenu
            ? <X className="w-4 h-4 text-neutral-600" />
            : <Menu className="w-4 h-4 text-neutral-400" />
          }
        </button>
      </div>

      {/* Expanded menu: icon toolbar */}
      {showMenu && (
        <div className="mt-2 pt-2 border-t border-neutral-100">
          {/* Icon toolbar */}
          <div className="flex items-center gap-1 mb-2">
            <ToolbarButton
              active={showLabelPicker}
              onClick={() => { closePickers(); setShowLabelPicker(!showLabelPicker); }}
              icon={<Tag className="w-4 h-4" />}
              title="Labels"
              hasValue={task.labels.length > 0}
            />
            <ToolbarButton
              active={showDuePicker}
              onClick={() => { closePickers(); setShowDuePicker(!showDuePicker); }}
              icon={<Clock className="w-4 h-4" />}
              title="Due date"
              hasValue={!!task.dueDate}
            />
            <ToolbarButton
              active={showAssignPicker}
              onClick={() => { closePickers(); setShowAssignPicker(!showAssignPicker); }}
              icon={<User className="w-4 h-4" />}
              title="Assignee"
              hasValue={!!task.assignedTo}
            />
            <ToolbarButton
              active={showPriorityPicker}
              onClick={() => { closePickers(); setShowPriorityPicker(!showPriorityPicker); }}
              icon={<AlertCircle className="w-4 h-4" />}
              title="Priority"
              hasValue={!!task.priority}
            />
            <ToolbarButton
              active={false}
              onClick={() => updateTask(task.id, { blocked: !task.blocked })}
              icon={<Flag className="w-4 h-4" />}
              title={task.blocked ? 'Unblock' : 'Block'}
              hasValue={task.blocked}
            />
            <ToolbarButton
              active={showSprintPicker}
              onClick={() => { closePickers(); setShowSprintPicker(!showSprintPicker); }}
              icon={<Zap className="w-4 h-4" />}
              title="Sprint"
              hasValue={!!task.sprintId}
            />
            <ToolbarButton
              active={false}
              onClick={() => updateTask(task.id, { isPrivate: !task.isPrivate })}
              icon={task.isPrivate
                ? <Lock className="w-4 h-4 text-purple-500" />
                : <Unlock className="w-4 h-4 text-neutral-400" />
              }
              title={task.isPrivate ? 'Make shared' : 'Make private'}
              hasValue={task.isPrivate}
            />
            <ToolbarButton
              active={false}
              onClick={() => convertTaskToItem(task.id)}
              icon={<Eye className="w-4 h-4" />}
              title="Convert to item"
            />

            <div className="flex-1" />

            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 hover:bg-neutral-100 rounded"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-neutral-400" />
            </button>
          </div>

          {/* Label picker */}
          {showLabelPicker && (
            <PickerSection title="Labels">
              <input
                type="text"
                value={labelQuery}
                onChange={e => setLabelQuery(e.target.value)}
                placeholder="Search labels..."
                className="w-full px-2 py-1 text-xs border rounded mb-2"
                autoFocus
              />
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {filteredLabels.map(l => (
                  <button
                    key={l.id}
                    onClick={() => toggleLabel(l.id)}
                    className={task.labels.includes(l.id) ? 'ring-2 ring-neutral-900 rounded' : ''}
                  >
                    <LabelBadge label={l} size="sm" />
                  </button>
                ))}
              </div>
            </PickerSection>
          )}

          {/* Due date picker */}
          {showDuePicker && (
            <PickerSection title="Due date">
              <input
                type="date"
                value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                onChange={e => updateTask(task.id, {
                  dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined,
                })}
                className="w-full px-2 py-1 text-xs border rounded"
              />
              <div className="flex gap-1 flex-wrap mt-2">
                {(['week', 'month', 'year'] as const).map(interval => (
                  <button
                    key={interval}
                    onClick={() => updateTask(task.id, {
                      repeatInterval: task.repeatInterval === interval ? undefined : interval,
                    })}
                    className={`px-2 py-1 text-xs rounded ${task.repeatInterval === interval
                      ? 'bg-blue-500 text-white'
                      : 'bg-neutral-100'
                      }`}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            </PickerSection>
          )}

          {/* Assignee picker */}
          {showAssignPicker && (
            <PickerSection title="Assign to">
              <input
                type="text"
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full px-2 py-1 text-xs border rounded mb-2"
                autoFocus
              />
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {filteredUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => updateTask(task.id, {
                      assignedTo: task.assignedTo === u.id ? undefined : u.id,
                    })}
                    className={`w-full px-2 py-1 text-left text-xs rounded flex items-center gap-2 ${task.assignedTo === u.id ? 'bg-blue-100' : 'hover:bg-neutral-50'
                      }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-xs">
                      {u.name.charAt(0)}
                    </div>
                    {u.name}
                  </button>
                ))}
              </div>
            </PickerSection>
          )}

          {/* Priority picker */}
          {showPriorityPicker && (
            <PickerSection title="Priority">
              <div className="flex gap-1">
                {(['urgent', 'normal', 'low'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => updateTask(task.id, { priority: p })}
                    className={`flex-1 px-2 py-1.5 text-xs rounded ${task.priority === p
                      ? p === 'urgent' ? 'bg-orange-500 text-white'
                        : p === 'normal' ? 'bg-blue-500 text-white'
                          : 'bg-neutral-500 text-white'
                      : p === 'urgent' ? 'bg-orange-50 text-orange-600'
                        : p === 'normal' ? 'bg-blue-50 text-blue-600'
                          : 'bg-neutral-50 text-neutral-600'
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </PickerSection>
          )}

          {/* Sprint picker */}
          {showSprintPicker && (
            <PickerSection title="Sprint">
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {sprints.map(s => (
                  <button
                    key={s.id}
                    onClick={() => updateTask(task.id, {
                      sprintId: task.sprintId === s.id ? undefined : s.id,
                    })}
                    className={`w-full px-2 py-1 text-left text-xs rounded flex items-center gap-2 ${task.sprintId === s.id ? 'bg-green-100' : 'hover:bg-neutral-50'
                      }`}
                  >
                    <Zap className="w-3 h-3" />
                    {s.name}
                  </button>
                ))}
              </div>
            </PickerSection>
          )}

          {/* Delete confirmation */}
          {showActions && (
            <PickerSection title="Delete task">
              <button
                onClick={() => { deleteTask(task.id); setShowActions(false); }}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Confirm delete
              </button>
            </PickerSection>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Sub-components ─────────────────────────────────────────────────── */

interface ToolbarButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hasValue?: boolean;
}

const ToolbarButton = ({ active, onClick, icon, title, hasValue }: ToolbarButtonProps) => {
  const iconElement = React.isValidElement(icon) ? icon : null;
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-black text-white' : 'hover:bg-neutral-100'}`}
      title={title}
    >
      {iconElement
        ? React.cloneElement(iconElement, {
            className: `w-4 h-4 ${active ? 'text-white' : hasValue ? 'text-blue-500' : 'text-neutral-400'}`,
          })
        : icon}
    </button>
  );
};

interface PickerSectionProps {
  title: string;
  children: React.ReactNode;
}

const PickerSection = ({ title, children }: PickerSectionProps) => (
  <div className="mt-2 pt-2 border-t border-neutral-100">
    <div className="text-xs text-neutral-600 mb-2 font-medium">{title}</div>
    {children}
  </div>
);
