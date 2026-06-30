import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Task, RepeatInterval, userDisplayName } from '../../types';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/pocketbase-client';
import { Check, ChevronDown, ChevronUp, Trash2, Tag, User, CalendarDays, Flag, ArrowLeftRight, RotateCcw, X, AlertTriangle, Inbox, Target, GitBranch, MoreHorizontal, Edit2, MessageSquare } from 'lucide-react';
import { t, formatDate } from '../../i18n/translations';
import { getRepeatChipLabel, getRepeatLabel, getRepeatOptions } from '../../lib/repeat-options';
import { getCompactUserName } from '../../lib/member-role-utils';
import { combineLocalDateAndTime, formatLocalDateInputValue, formatLocalTimeInputValue, parseLocalDateInputValue } from '../../lib/date-local';
import { buildFlagUpdate, getCommentButtonActive } from '../../lib/task-attribute-utils';

// Subtask icon: square with dot inside
const SubtaskIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="8" r="2.5" fill="currentColor" />
  </svg>
);
import { AttributeChip } from './AttributeChip';
import { entityColor } from '../../lib/entity-colors';
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ORDER } from '../../lib/priority';
import { PriorityIcon } from '../../lib/PriorityIcon';

interface CompactTaskCardProps {
  task: Task;
  showCheckbox?: boolean;
  urgent?: boolean;
  startExpanded?: boolean;
  compact?: boolean;
  className?: string;
  calendarTimeLabel?: string;
  hideDateChip?: boolean;
  calendarBlock?: boolean;
  calendarPopoverAlign?: 'left' | 'right';
}

type TaskEditor = 'labels' | 'assignee' | 'schedule' | 'priority' | 'subtasks' | 'comment' | 'others' | null;

const DeleteConfirm = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
    <div className="bg-white rounded-lg shadow-xl p-5 mx-4 max-w-xs w-full">
      <p className="text-sm font-medium text-neutral-900 mb-4">{t('common.confirmDeleteTitle')}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
        >
          {t('common.no')}
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
        >
          {t('common.confirm')}
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
          {t('common.cancel')}
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
        >
          {confirmLabel || t('common.confirm')}
        </button>
      </div>
    </div>
  </div>
);

export const CompactTaskCard = ({ task, showCheckbox = true, urgent = false, startExpanded = false, compact = false, className = '', calendarTimeLabel, hideDateChip = false, calendarBlock = false, calendarPopoverAlign = 'left' }: CompactTaskCardProps) => {
  const { updateTask, deleteTask, labels, users, shops, tasks, addLabel, addTask, swapEntity, toggleChipFilter, isChipFilterActive, refreshEntries, showCompletionMessage, moveTaskToStatus } = useApp();
  const [showMenu, setShowMenu] = useState(startExpanded);
  const [activeEditor, setActiveEditor] = useState<TaskEditor>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [isDeleteHover, setIsDeleteHover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [titleDraft, setTitleDraft] = useState(startExpanded ? task.title : '');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskEditMode, setSubtaskEditMode] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const [subtaskPendingDelete, setSubtaskPendingDelete] = useState<Task | null>(null);
  const [showParentPicker, setShowParentPicker] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [commentDraft, setCommentDraft] = useState(task.blockedComment || '');
  const [pendingFlagActivation, setPendingFlagActivation] = useState(false);
  const [commentError, setCommentError] = useState('');

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

  useEffect(() => {
    setCommentDraft(task.blockedComment || '');
    if (!task.flag) {
      setPendingFlagActivation(false);
      setCommentError('');
    }
  }, [task.blockedComment, task.flag]);

  const isDone = task.status === 'done';
  const assignedUser = task.assignedTo ? users.find((u) => u.id === task.assignedTo) : null;
  const assigneeColor = assignedUser ? entityColor(assignedUser.id) : undefined;
  const isFlagged = task.flag && !isDone;
  const isFocusTask = !!task.focus && !isDone;
  const isOverdue = !!task.dueDate && task.dueDate < Date.now() && !isDone;
  const dateStr = task.dueDate
    ? formatDate(task.dueDate, { month: 'short', day: 'numeric' })
    : null;

  const repeatLabel = getRepeatLabel(task.repeatInterval, task.dueDate);
  const repeatChipLabel = getRepeatChipLabel(task.repeatInterval, task.dueDate);
  const hasComment = !!task.blockedComment?.trim();

  // Subtasks: tasks that have this task's id in their linkedTo/linkedType (subtask relationship)
  const subtasks = (task.subtaskIds || [])
    .map(id => tasks.find(t => t.id === id))
    .filter(Boolean) as Task[];
  const subtaskCount = subtasks.length;
  const completedSubtaskCount = subtasks.filter(s => s.status === 'done').length;

  const handleToggle = () => {
    if (task.status === 'done') {
      updateTask(task.id, { status: 'todo', completedAt: undefined, completedBy: undefined });
    } else {
      updateTask(task.id, { status: 'done', completedAt: Date.now(), completedBy: users.find(u => u.id === (task.assignedTo || ''))?.id || undefined });
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

  const clearPriority = () => {
    updateTask(task.id, { priority: null });
  };

  const openCommentEditor = (flagActivation = false) => {
    setCommentDraft(task.blockedComment || '');
    setCommentError('');
    setPendingFlagActivation(flagActivation);
    setActiveEditor('comment');
  };

  const commitComment = () => {
    const trimmedComment = commentDraft.trim();

    if (pendingFlagActivation) {
      const result = buildFlagUpdate(task, commentDraft);
      if ('error' in result) {
        setCommentError(t('tasks.commentRequiredForFlag'));
        return;
      }
      updateTask(task.id, result.update);
      setPendingFlagActivation(false);
      setCommentError('');
      setActiveEditor(null);
      return;
    }

    if (task.flag && !trimmedComment) {
      setCommentError(t('tasks.commentRequiredForFlag'));
      return;
    }

    updateTask(task.id, { blockedComment: trimmedComment || null });
    setCommentError('');
    setActiveEditor(null);
  };

  const handleToggleFlag = () => {
    if (task.flag) {
      const result = buildFlagUpdate(task, commentDraft || task.blockedComment || '');
      if ('update' in result) {
        updateTask(task.id, result.update);
      }
      setPendingFlagActivation(false);
      setCommentError('');
      if (activeEditor === 'comment') {
        setActiveEditor(null);
      }
      return;
    }

    openCommentEditor(true);
  };

  const removeLabel = (labelId: string) => {
    updateTask(task.id, {
      labels: task.labels.filter((id) => id !== labelId),
    });
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    deleteTask(task.id);
    setShowMenu(false);
    setActiveEditor(null);
  };

  const commitSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    try {
      await api.createSubtask(title, task.id);
      setSubtaskTitle('');
      await refreshEntries();
      showCompletionMessage(t('tasks.subtaskAdded'));
    } catch (err: any) {
      showCompletionMessage(err.message || t('tasks.failedToCreateSubtask'));
    }
  };

  const startEditingSubtask = (subtask: Task) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  const commitSubtaskEdit = () => {
    if (!editingSubtaskId) return;
    const title = editingSubtaskTitle.trim();
    const original = subtasks.find((subtask) => subtask.id === editingSubtaskId);
    if (!original) {
      setEditingSubtaskId(null);
      setEditingSubtaskTitle('');
      return;
    }
    if (!title) {
      setEditingSubtaskTitle(original.title);
      setEditingSubtaskId(null);
      return;
    }
    if (title !== original.title) {
      updateTask(editingSubtaskId, { title });
    }
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
  };

  const handleSubtaskDelete = () => {
    if (!subtaskPendingDelete) return;
    deleteTask(subtaskPendingDelete.id);
    setSubtaskPendingDelete(null);
    if (editingSubtaskId === subtaskPendingDelete.id) {
      setEditingSubtaskId(null);
      setEditingSubtaskTitle('');
    }
  };

  const dateValue = formatLocalDateInputValue(task.dueDate);
  const timeValue = formatLocalTimeInputValue(task.dueDate);
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
  const parentTaskMatches = useMemo(() => {
    const query = parentSearch.trim().toLowerCase();
    return tasks
      .filter((candidate) => {
        if (candidate.id === task.id || candidate.status === 'done') return false;
        if (!query) return true;
        return candidate.title.toLowerCase().includes(query);
      })
      .slice(0, 6);
  }, [parentSearch, task.id, tasks]);

  const isLabelFiltered = (id: string) => isChipFilterActive('label', id);
  const isAssigneeFiltered = (id?: string) => id ? isChipFilterActive('assignee', id) : false;
  const isDateFiltered = (ds: string) => isChipFilterActive('date', ds);
  const isRepeatFiltered = (repeatInterval?: RepeatInterval | null) => repeatInterval ? isChipFilterActive('repeat', repeatInterval) : false;
  const cardPaddingClass = compact && !showMenu ? 'p-1.5' : 'p-2.5';

  const openEditor = (editor: TaskEditor) => {
    setShowMenu(true);
    setActiveEditor(editor);
  };

  const expandFromCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    trackInteraction();
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [role="button"]')) return;
    if (!showMenu) {
      setShowMenu(true);
      setTitleDraft(task.title);
      setActiveEditor(null);
    }
  };

  const resetParentPicker = () => {
    setShowParentPicker(false);
    setParentSearch('');
  };

  const detachFromParentTask = (parentTaskId?: string | null) => {
    if (!parentTaskId) return;
    const parentTask = tasks.find((candidate) => candidate.id === parentTaskId);
    if (!parentTask?.subtaskIds?.includes(task.id)) return;

    updateTask(parentTask.id, {
      subtaskIds: parentTask.subtaskIds.filter((subtaskId) => subtaskId !== task.id),
    });
  };

  const linkToParentTask = (parentTask: Task) => {
    detachFromParentTask(task.linkedTo);
    updateTask(task.id, { linkedTo: parentTask.id, linkedType: 'task' });
    const current = parentTask.subtaskIds || [];
    if (!current.includes(task.id)) {
      updateTask(parentTask.id, { subtaskIds: [...current, task.id] });
    }
    showCompletionMessage(t('tasks.linkedUnder').replace('{title}', parentTask.title));
    resetParentPicker();
    setActiveEditor(null);
  };

  return (
    <>
      <div
        ref={cardRef}
        data-testid={`compact-task-card-${task.id}`}
        data-component="CompactTaskCard"
        onClick={expandFromCardClick}
        style={calendarBlock ? (calendarBlock && showMenu ? { width: 'calc(100vw - 24px)', maxWidth: '430px' } : undefined) : Object.assign({ borderRadius: '20px', boxShadow: '0 2px 8px rgba(99,102,241,0.07), 0 1px 3px rgba(0,0,0,0.04)', border: '1px solid rgba(99,102,241,0.08)', transition: 'transform 150ms ease, box-shadow 150ms ease', WebkitTapHighlightColor: 'transparent' }, calendarBlock && showMenu ? { width: 'calc(100vw - 24px)', maxWidth: '430px' } : {})}
        className={`${calendarBlock ? 'rounded-sm' : 'rounded-lg'} border transition-colors ${
          isDone
            ? 'border-neutral-200 opacity-75'
            : isFocusTask
              ? 'border-violet-400 hover:border-violet-500 shadow-[0_0_0_1px_rgba(124,58,237,0.12)]'
              : 'border-neutral-200 hover:border-neutral-300'
        } ${
          urgent
            ? '!border-orange-400 !bg-orange-50'
            : isFlagged
              ? 'border-red-300 !bg-red-50'
              : isOverdue
                ? '!bg-orange-50'
                : isFocusTask
                  ? '!bg-violet-100/80'
                  : 'bg-white'
        } ${showMenu ? 'ring-1 ring-neutral-300 !bg-neutral-50' : ''} ${calendarBlock ? (showMenu ? `absolute top-0 ${calendarPopoverAlign === 'right' ? 'right-0' : 'left-0'} z-50 max-w-none !rounded-sm !bg-white shadow-2xl` : 'h-full overflow-hidden !rounded-sm !border-violet-300 !bg-violet-100') : ''} ${className}`}>
        <div className={cardPaddingClass}>
          {/* Line 1: checkbox + title + hamburger */}
          <div className="flex items-center gap-2">
            {showCheckbox && (
              <button
                onClick={handleToggle}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isDone
                    ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 border-transparent text-white shadow-[0_2px_8px_rgba(34,197,94,0.3)]'
                    : 'border-neutral-300 hover:border-neutral-500'
                }`}
                aria-label={isDone ? t('common.markAsNotDone') : t('common.markAsDone')}
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
                className={`${compact ? 'text-xs' : 'text-sm'} font-medium flex-1 min-w-0 px-1.5 py-0.5 border border-neutral-300 rounded bg-white ${
                  isDone ? 'line-through text-neutral-400' : isFlagged ? 'text-red-900' : 'text-neutral-900'
                }`}
                aria-label={t('tasks.editTaskTitle')}
              />
            ) : (
            <span className={`${calendarBlock ? 'text-[12px] font-bold' : compact ? 'text-xs font-medium' : 'text-sm font-medium'} flex-1 truncate ${
              isDone ? 'line-through text-neutral-400' : isFlagged ? 'text-red-900' : 'text-neutral-900'
            }`}>
              {task.title}
            </span>
            )}

            {/* Expander */}
            <button
              onClick={() => {
                const next = !showMenu;
                setShowMenu(next);
                setActiveEditor(null);
                if (next) {
                  setTitleDraft(task.title);
                } else {
                  setSubtaskEditMode(false);
                  setEditingSubtaskId(null);
                  setEditingSubtaskTitle('');
                  setSubtaskPendingDelete(null);
                  resetParentPicker();
                }
              }}
              className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
              aria-label={showMenu ? t('common.closeEditor') : t('common.openEditor')}
            >
              {showMenu 
                ? <ChevronUp className="w-4 h-4 text-neutral-600 transition-transform duration-200" /> 
                : <ChevronDown className="w-4 h-4 text-neutral-400 transition-transform duration-200" />
              }
            </button>
          </div>
          {calendarTimeLabel && !showMenu && (
            <div className="mt-0.5 truncate text-[10px] font-bold leading-tight text-violet-700">{calendarTimeLabel}</div>
          )}

          {/* Line 2: chips — labels, assignee, date, repeat, subtask progress (always visible) */}
          {!isDone && (hasLabels || assignedUser || (!hideDateChip && dateStr) || subtaskCount > 0 || (task.priority && PRIORITY_COLORS[task.priority]) || !!task.repeatInterval || hasComment) && (
            <div className={`flex flex-wrap items-center gap-1 mt-1.5 ml-0.5 ${compact && !showMenu ? 'max-h-7 overflow-hidden' : ''}`}>
              {task.labels.map((labelId) => {
                const label = labels.find((l) => l.id === labelId);
                return label ? (
                  <AttributeChip
                    key={label.id}
                    icon={<Tag className="w-3.5 h-3.5" />}
                    label={label.name}
                    color={label.color}
                    active={isLabelFiltered(label.id)}
                    onClick={showMenu ? () => removeLabel(label.id) : () => toggleChipFilter('label', label.id, label.name, label.color)}
                  />
                ) : null;
              })}
              {assignedUser && (
                <button
                  onClick={showMenu ? clearAssignee : () => toggleChipFilter('assignee', assignedUser.id, getCompactUserName(assignedUser), assigneeColor)}
                  className={`inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white transition-transform active:scale-95 ${
                    isAssigneeFiltered(assignedUser.id) ? 'ring-2 ring-offset-1' : ''
                  }`}
                  style={{
                    backgroundColor: assigneeColor || '#6366f1',
                    ...(isAssigneeFiltered(assignedUser.id) ? { ringColor: assigneeColor || '#6366f1' } as React.CSSProperties : {}),
                  }}
                  title={getCompactUserName(assignedUser)}
                  aria-label={`${t('tasks.assignee')}: ${getCompactUserName(assignedUser)}`}
                >
                  {assignedUser.avatarUrl ? (
                    <img src={assignedUser.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    getCompactUserName(assignedUser).charAt(0).toUpperCase()
                  )}
                </button>
              )}
              {dateStr && !hideDateChip && !isDone && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500"
                  onClick={showMenu ? clearAllSchedule : () => toggleChipFilter('date', dateStr)}
                  style={{ cursor: showMenu || isDateFiltered(dateStr) ? 'pointer' : undefined }}
                >
                  <CalendarDays className="w-3 h-3" />
                  {dateStr}
                </span>
              )}
              {repeatLabel && !isDone && (
                <AttributeChip
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  label={repeatChipLabel || repeatLabel}
                  color="#0f766e"
                  active={isRepeatFiltered(task.repeatInterval)}
                  onClick={showMenu ? clearAllSchedule : () => task.repeatInterval && toggleChipFilter('repeat', task.repeatInterval, repeatLabel)}
                  maxWidthClassName="max-w-[92px]"
                />
              )}
              {hasComment && (
                <button
                  type="button"
                  onClick={() => openCommentEditor()}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
                  aria-label={t('tasks.comment')}
                  title={t('tasks.comment')}
                >
                  <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
              {subtaskCount > 0 && (
                <AttributeChip
                  icon={<SubtaskIcon className="w-3.5 h-3.5" />}
                  label={`${completedSubtaskCount}/${subtaskCount}`}
                  color="#8b5cf6"
                />
              )}
              {task.priority && PRIORITY_COLORS[task.priority] && (
                <button
                  onClick={showMenu ? clearPriority : () => toggleChipFilter('priority', task.priority, PRIORITY_LABELS[task.priority] || task.priority, PRIORITY_COLORS[task.priority] || '#6b7280')}
                  className="inline-flex items-center justify-center"
                  title={PRIORITY_LABELS[task.priority] || task.priority}
                  aria-label={`${t('tasks.priority')}: ${PRIORITY_LABELS[task.priority] || task.priority}`}
                >
                  <PriorityIcon priority={task.priority} size={15} />
                </button>
              )}
            </div>
          )}

          {/* Expanded section — attribute action row + inline editors */}
          {showMenu && (
            <div className="mt-2 pt-2 border-t border-neutral-100">
              {/* Attribute buttons */}
              <div className={`flex items-center gap-2 ${calendarBlock ? 'flex-wrap' : ''}`}>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'labels' ? null : 'labels')}
                  className={`p-1.5 rounded transition-colors ${
                    hasLabels || activeEditor === 'labels'
                      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title={t('tasks.labelTooltip')}
                  aria-label={t('tasks.editLabels')}
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
                  title={t('tasks.assigneeTooltip')}
                  aria-label={t('tasks.editAssignee')}
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
                  title={t('tasks.scheduleTooltip')}
                  aria-label={t('tasks.editSchedule')}
                >
                  <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'subtasks' ? null : 'subtasks')}
                  className={`p-1.5 rounded transition-colors ${
                    subtaskCount > 0 || activeEditor === 'subtasks'
                      ? 'bg-purple-100 text-purple-700'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title={t('tasks.subtasksTooltip')}
                  aria-label={t('tasks.viewSubtasks')}
                >
                  <SubtaskIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'priority' ? null : 'priority')}
                  className={`p-1.5 rounded transition-colors ${
                    task.priority && PRIORITY_COLORS[task.priority]
                      ? 'text-white'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  style={
                    task.priority && PRIORITY_COLORS[task.priority]
                      ? { backgroundColor: PRIORITY_COLORS[task.priority] }
                      : undefined
                  }
                  title={t('tasks.priority')}
                  aria-label={t('tasks.editPriority')}
                >
                  <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
                </button>
                {/* Focus toggle */}
                <button
                  onClick={() => updateTask(task.id, { focus: !task.focus })}
                  className={`p-1.5 rounded transition-colors ${
                    task.focus ? 'bg-orange-100 text-orange-700' : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title={task.focus ? 'Remove focus' : 'Add focus'}
                  aria-label={t('tasks.toggleFocus')}
                >
                  <Target className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => openCommentEditor()}
                  className={`p-1.5 rounded transition-colors ${
                    getCommentButtonActive(task) || activeEditor === 'comment'
                      ? 'bg-neutral-900 text-white'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title={t('tasks.comment')}
                  aria-label={t('tasks.comment')}
                >
                  <MessageSquare className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={handleToggleFlag}
                  className={`p-1.5 rounded transition-colors ${task.flag ? 'bg-red-100 text-red-700' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title={t('tasks.flagTooltip')}
                  aria-label={t('tasks.toggleFlag')}
                >
                  <Flag className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setActiveEditor(activeEditor === 'others' ? null : 'others')}
                  className={`p-1.5 rounded transition-colors ${
                    activeEditor === 'others' ? 'bg-neutral-200 text-neutral-700' : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title={t('tasks.otherActions')}
                  aria-label={t('tasks.otherActions')}
                >
                  <MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded transition-colors text-red-600 hover:bg-red-50"
                  title={t('common.delete')}
                  aria-label={t('tasks.deleteTask')}
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
                      placeholder={t('tasks.labelInputPlaceholder')}
                      className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label={t('tasks.labelInputAria')}
                    />
                    {hasLabels && (
                      <button onClick={clearAllLabels} className="p-1.5 text-red-500 hover:bg-red-50 rounded text-sm" aria-label={t('tasks.clearAllLabels')} title={t('common.clearAllTooltip')}>
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
                          updateTask(task.id, { labels: has ? task.labels.filter((id) => id !== label.id) : [...task.labels, label.id] });
                        }}
                      >
                        <span
                          className="inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-xs font-normal leading-none border"
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
                        if (e.key === 'Enter' && filteredUsers.length === 1) commitAssignee(filteredUsers[0].id);
                        if (e.key === 'Escape') setActiveEditor(null);
                      }}
                      placeholder={t('tasks.searchAssigneePlaceholder')}
                      className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label={t('tasks.searchAssigneeAria')}
                    />
                    {hasAssignee && (
                      <button onClick={clearAssignee} className="p-1.5 text-red-500 hover:bg-red-50 rounded text-sm" aria-label={t('tasks.clearAssigneeAria')} title={t('tasks.removeAssignee')}>
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {filteredUsers.length > 0 && (
                    <div className="absolute z-[100] mt-1 w-full bg-white border border-neutral-300 rounded-md shadow-[0_4px_16px_rgba(0,0,0,0.15)] ring-1 ring-black/5 max-h-40 overflow-y-auto">
                      {filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => { const val = task.assignedTo === u.id ? null : u.id; commitAssignee(val); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 flex items-center gap-2 ${task.assignedTo === u.id ? 'bg-neutral-50 font-medium' : ''}`}
                        >
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0" style={{ backgroundColor: entityColor(u.id) }}>
                            {getCompactUserName(u).charAt(0).toUpperCase()}
                          </span>
                          <span>{getCompactUserName(u)}</span>
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
                        if (!e.target.value) { updateTask(task.id, { dueDate: null }); return; }
                        const nextDueDate = combineLocalDateAndTime(e.target.value, timeValue || '00:00') ?? parseLocalDateInputValue(e.target.value);
                        updateTask(task.id, { dueDate: nextDueDate });
                      }}
                      className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label={t('tasks.dueDateAria')}
                    />
                    <input
                      type="time"
                      value={timeValue}
                      onChange={(e) => {
                        if (!dateValue) return;
                        const nextDueDate = combineLocalDateAndTime(dateValue, e.target.value || '00:00');
                        updateTask(task.id, { dueDate: nextDueDate });
                      }}
                      className="text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label={t('tasks.dueTimeAria')}
                    />
                    <select
                      value={task.repeatInterval || ''}
                      onChange={(e) => updateTask(task.id, { repeatInterval: (e.target.value || null) as RepeatInterval | null })}
                      className="w-44 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                      aria-label={t('tasks.recurringIntervalAria')}
                    >
                      {getRepeatOptions(task.dueDate).map((option) => (
                        <option key={option.value || 'none'} value={option.value} disabled={option.disabled}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Subtasks editor */}
              {activeEditor === 'subtasks' && (
                <div className="mt-2 pt-2 border-t space-y-1.5 border-purple-100">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-medium text-purple-600">{t('tasks.subtasks')} ({subtaskCount})</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !subtaskEditMode;
                        setSubtaskEditMode(next);
                        if (!next) { setEditingSubtaskId(null); setEditingSubtaskTitle(''); }
                      }}
                      className={`p-1 rounded transition-colors ${subtaskEditMode ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                      title={t('tasks.subtasksEditTitle')}
                      aria-label={t('tasks.subtasksEditAria')}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {subtasks.map((subtask) => {
                    const isEditing = editingSubtaskId === subtask.id;
                    return (
                      <div key={subtask.id} className={`flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded border ${subtaskCount > 0 ? 'bg-purple-50/50 border-purple-100' : 'bg-neutral-50 border-neutral-100'}`}>
                        <button
                          type="button"
                          onClick={() => { if (subtask.status === 'done') { updateTask(subtask.id, { status: 'todo', completedAt: undefined }); } else { updateTask(subtask.id, { status: 'done', completedAt: Date.now() }); } }}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${subtask.status === 'done' ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 border-transparent text-white' : 'border-neutral-300 hover:border-neutral-500'}`}
                          aria-label={subtask.status === 'done' ? t('tasks.markSubtaskAsNotDone') : t('tasks.markSubtaskAsDone')}
                        >
                          {subtask.status === 'done' && <Check className="w-2.5 h-2.5" />}
                        </button>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingSubtaskTitle}
                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                            onBlur={commitSubtaskEdit}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitSubtaskEdit(); if (e.key === 'Escape') { setEditingSubtaskId(null); setEditingSubtaskTitle(''); } }}
                            autoFocus
                            className="flex-1 text-xs px-2 py-1 border border-neutral-200 rounded bg-white"
                            aria-label={t('tasks.subtaskTitleEditAria')}
                          />
                        ) : (
                          <span className={`text-xs flex-1 truncate ${subtask.status === 'done' ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>{subtask.title}</span>
                        )}
                        {subtaskEditMode && (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => startEditingSubtask(subtask)} className="p-1 rounded text-neutral-500 hover:bg-white hover:text-neutral-700 transition-colors" title={t('tasks.subtaskEditTitle')} aria-label={t('tasks.subtaskEditTitle')}><Edit2 className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => setSubtaskPendingDelete(subtask)} className="p-1 rounded text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors" title={t('tasks.subtaskDeleteTitle')} aria-label={t('tasks.subtaskDeleteTitle')}><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className={`flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 rounded border ${subtaskCount > 0 ? 'bg-purple-50 border-purple-200' : 'bg-neutral-50 border-dashed border-neutral-200'}`}>
                    <SubtaskIcon className={`w-4 h-4 flex-shrink-0 ${subtaskCount > 0 ? 'text-purple-500' : 'text-neutral-300'}`} />
                    <input
                      type="text"
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                      onFocus={() => setActiveEditor('subtasks')}
                      onKeyDown={async (e) => { if (e.key === 'Enter') { await commitSubtask(); } }}
                      placeholder={t('tasks.newSubtaskTitle')}
                      className="flex-1 text-xs px-0 py-0 bg-transparent border-0 focus:outline-none placeholder:text-neutral-400"
                      aria-label={t('tasks.newSubtaskTitle')}
                    />
                    {subtaskTitle.trim() && (
                      <button type="button" onClick={commitSubtask} className="px-2 py-1 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors" aria-label={t('tasks.addSubtask')}>{t('common.add')}</button>
                    )}
                  </div>
                </div>
              )}

              {/* Comment editor */}
              {activeEditor === 'comment' && (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={commentDraft}
                    onChange={(e) => { setCommentDraft(e.target.value); if (commentError) setCommentError(''); }}
                    placeholder={t('tasks.commentPlaceholder')}
                    className={`w-full min-h-[88px] text-sm px-3 py-2 border rounded resize-none ${commentError ? 'border-red-300 bg-red-50/40' : 'border-neutral-200 bg-white'}`}
                    aria-label={t('tasks.comment')}
                    autoFocus
                  />
                  {commentError && <p className="text-xs text-red-600">{commentError}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => { setCommentDraft(task.blockedComment || ''); setPendingFlagActivation(false); setCommentError(''); setActiveEditor(null); }} className="px-3 py-1.5 border border-neutral-200 rounded text-sm text-neutral-600">{t('common.cancel')}</button>
                    <button type="button" onClick={commitComment} className="px-3 py-1.5 bg-neutral-900 text-white rounded text-sm">{pendingFlagActivation ? t('tasks.addCommentAndFlag') : t('common.save')}</button>
                  </div>
                </div>
              )}

              {/* Priority editor */}
              {activeEditor === 'priority' && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => { updateTask(task.id, { priority: null }); setActiveEditor(null); }} className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${!task.priority ? 'bg-neutral-900 text-white shadow-sm' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>None</button>
                    {PRIORITY_ORDER.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => { updateTask(task.id, { priority: p }); setActiveEditor(null); }}
                        className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${task.priority === p ? 'text-white shadow-sm' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                        style={task.priority === p ? { backgroundColor: PRIORITY_COLORS[p] } : undefined}
                      >
                        {PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Others editor */}
              {activeEditor === 'others' && (
                <div className="mt-2 space-y-1.5">
                  <button type="button" onClick={() => swapEntity(task.id)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded border border-neutral-200 hover:bg-neutral-50 transition-colors">
                    <ArrowLeftRight className="w-4 h-4 text-neutral-500" strokeWidth={1.75} />
                    <span>{t('tasks.swap')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (task.linkedType === 'task' && task.linkedTo) { detachFromParentTask(task.linkedTo); updateTask(task.id, { linkedTo: null, linkedType: null }); showCompletionMessage(t('tasks.promotedStandalone')); resetParentPicker(); setActiveEditor(null); return; }
                      setShowParentPicker((current) => !current); setParentSearch('');
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded border transition-colors ${task.linkedType === 'task' && task.linkedTo ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-neutral-200 hover:bg-neutral-50'}`}
                  >
                    <GitBranch className="w-4 h-4" strokeWidth={1.75} />
                    <span>{task.linkedType === 'task' && task.linkedTo ? t('tasks.makeMainTask') : t('tasks.makeSubTask')}</span>
                  </button>
                  {!(task.linkedType === 'task' && task.linkedTo) && showParentPicker && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-2.5 space-y-2">
                      <input type="text" value={parentSearch} onChange={(e) => setParentSearch(e.target.value)} placeholder={t('tasks.parentTaskSearchPlaceholder')} className="w-full text-sm px-3 py-2 border border-purple-200 rounded bg-white" autoFocus />
                      <div className="space-y-1">
                        {parentTaskMatches.length > 0 ? parentTaskMatches.map((parentTask) => (
                          <button key={parentTask.id} type="button" onClick={() => linkToParentTask(parentTask)} className="w-full text-left px-3 py-2 rounded border border-white/70 bg-white hover:border-purple-300 hover:bg-purple-50 transition-colors">
                            <span className="block text-sm font-medium text-neutral-900 truncate">{parentTask.title}</span>
                            {parentTask.dueDate && <span className="block text-xs text-neutral-500 mt-0.5">{formatDate(parentTask.dueDate, { month: 'short', day: 'numeric' })}</span>}
                          </button>
                        )) : (
                          <div className="px-3 py-2 text-xs text-neutral-500 bg-white rounded border border-dashed border-purple-200">{t('tasks.noMatchingParentTask')}</div>
                        )}
                      </div>
                    </div>
                  )}
                  {task.status !== 'backlog' && (
                    <button type="button" onClick={() => { moveTaskToStatus(task.id, 'backlog'); showCompletionMessage(t('tasks.movedToBacklog')); setActiveEditor(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
                      <Inbox className="w-4 h-4" strokeWidth={1.75} />
                      <span>{t('tasks.inbox')}</span>
                    </button>
                  )}
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

      {subtaskPendingDelete && (
        <ConfirmDialog
          title={`Verwijder subtask "${subtaskPendingDelete.title}"?`}
          confirmLabel={t('common.delete')}
          onConfirm={handleSubtaskDelete}
          onCancel={() => setSubtaskPendingDelete(null)}
        />
      )}
    </>
  );
};
