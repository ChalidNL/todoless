import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Task, RepeatInterval, userDisplayName } from '../../types';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/pocketbase-client';
import { Check, ChevronDown, ChevronUp, Trash2, Tag, User, CalendarDays, Flag, ArrowLeftRight, RotateCcw, X, AlertTriangle, Inbox, Target, GitBranch, MoreHorizontal, Edit2, MessageSquare } from 'lucide-react';
import { t, formatDate } from '../../i18n/translations';
import { sortLabelsByVisibility } from '../../lib/label-utils';
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

const parseMaybeJsonArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
  } catch {
    return value ? [value] : [];
  }
};

const uniqueIds = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const getTaskLabelIds = (task: Task) => uniqueIds([
  ...parseMaybeJsonArray(task.labels),
  ...parseMaybeJsonArray((task as any).labelId),
  ...parseMaybeJsonArray((task as any).label),
]);

const getTaskSubtaskIds = (task: Task) => uniqueIds([
  ...parseMaybeJsonArray(task.subtaskIds),
  ...parseMaybeJsonArray((task as any).subtask_ids),
]);

const getTaskDueDate = (task: Task) => {
  const value = task.dueDate ?? (task as any).due_date;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? [parsed] : value ? [value] : [];
    } catch {
      return [value];
    }
  }
  return [];
};

const recordId = (record: unknown) => typeof record === 'object' && record ? String((record as any).id || '') : typeof record === 'string' ? record : '';

const getExpandedLabelObjects = (task: Task, availableLabels: any[]) => {
  const expanded = (task as any).expand || {};
  const candidates = [
    ...asArray(expanded.labels),
    ...asArray(expanded.label),
    ...asArray((task as any).labels),
    ...asArray((task as any).label),
    ...asArray((task as any).labelId),
  ];
  const byId = new Map(availableLabels.map((label) => [label.id, label]));
  const seen = new Set<string>();
  return candidates
    .map((candidate) => {
      if (typeof candidate === 'string') return byId.get(candidate);
      if (candidate && typeof candidate === 'object') return candidate;
      return null;
    })
    .filter((label): label is any => {
      const id = recordId(label);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
};

const getExpandedAssignee = (task: Task, availableUsers: any[]) => {
  const expanded = (task as any).expand || {};
  const candidate = expanded.assignee || expanded.assigned_to || (task as any).assignee;
  if (candidate && typeof candidate === 'object') return candidate;
  const id = task.assignedTo || (task as any).assigned_to || recordId(candidate);
  return id ? availableUsers.find((user) => user.id === id) || null : null;
};

const getExpandedSubtasks = (task: Task, availableTasks: Task[]) => {
  const expanded = (task as any).expand || {};
  const candidates = [
    ...asArray(expanded.subtasks),
    ...asArray(expanded.subtask_ids),
    ...asArray((task as any).subtasks),
    ...asArray((task as any).subtaskIds),
    ...asArray((task as any).subtask_ids),
  ];
  const byId = new Map(availableTasks.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();
  return candidates
    .map((candidate) => {
      if (typeof candidate === 'string') return byId.get(candidate);
      if (candidate && typeof candidate === 'object') return candidate as Task;
      return null;
    })
    .filter((subtask): subtask is Task => {
      const id = recordId(subtask);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
};

const isSubtaskDone = (subtask: any) => subtask.completed === true || subtask.status === 'done';

const getTaskCommentCount = (task: Task) => {
  const explicit = (task as any).commentCount ?? (task as any).reactionCount;
  if (typeof explicit === 'number') return explicit;
  const comments = (task as any).comments;
  if (Array.isArray(comments)) return comments.length;
  return task.blockedComment?.trim() ? 1 : 0;
};

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
  const taskLabelObjects = getExpandedLabelObjects(task, labels);
  const labelIds = taskLabelObjects.map((label) => label.id);
  const dueDate = getTaskDueDate(task);
  const assignedUser = getExpandedAssignee(task, users);
  const assignedTo = assignedUser?.id || task.assignedTo || (task as any).assigned_to;
  const assigneeColor = assignedUser ? entityColor(assignedUser.id) : undefined;
  const isFlagged = task.flag && !isDone;
  const isFocusTask = !!task.focus && !isDone;
  const isOverdue = !!dueDate && dueDate < Date.now() && !isDone;
  const dateStr = dueDate
    ? formatDate(dueDate, { month: 'short', day: 'numeric' })
    : null;

  const repeatLabel = getRepeatLabel(task.repeatInterval, dueDate);
  const repeatChipLabel = getRepeatChipLabel(task.repeatInterval, dueDate);
  const hasComment = !!task.blockedComment?.trim();

  // Subtasks: prefer PocketBase expand.subtasks, then subtask id relations.
  const subtasks = getExpandedSubtasks(task, tasks);
  const subtaskCount = subtasks.length;
  const completedSubtaskCount = subtasks.filter(isSubtaskDone).length;
  const commentCount = getTaskCommentCount(task);

  const handleToggle = () => {
    if (task.status === 'done') {
      updateTask(task.id, { status: 'todo', completedAt: undefined, completedBy: undefined });
    } else {
      updateTask(task.id, { status: 'done', completedAt: Date.now(), completedBy: users.find(u => u.id === (assignedTo || ''))?.id || undefined });
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
      labels: labelIds.filter((id) => id !== labelId),
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

  const dateValue = formatLocalDateInputValue(dueDate);
  const timeValue = formatLocalTimeInputValue(dueDate);
  const filteredUsers = users.filter((u) =>
    userDisplayName(u).toLowerCase().includes(assigneeSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(assigneeSearch.toLowerCase())
  );
  const visibleLabels = sortLabelsByVisibility(labels.filter((l) =>
    l.name.toLowerCase().includes(labelInput.trim().toLowerCase())
  ));
  const hasLabels = taskLabelObjects.length > 0;
  const hasAssignee = !!assignedUser;
  const hasSchedule = !!dueDate || !!task.repeatInterval;
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
    const parentSubtaskIds = getTaskSubtaskIds(parentTask);
    if (!parentSubtaskIds.includes(task.id)) return;

    updateTask(parentTask.id, {
      subtaskIds: parentSubtaskIds.filter((subtaskId) => subtaskId !== task.id),
    });
  };

  const linkToParentTask = (parentTask: Task) => {
    detachFromParentTask(task.linkedTo);
    updateTask(task.id, { linkedTo: parentTask.id, linkedType: 'task' });
    const current = getTaskSubtaskIds(parentTask);
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
        style={calendarBlock && showMenu ? { width: 'calc(100vw - 24px)', maxWidth: '430px' } : undefined}
        className={`app-card ${showMenu ? 'app-card-expanded' : ''} ${calendarBlock ? 'app-calendar-event' : ''} ${calendarBlock ? 'rounded-sm' : 'rounded-lg'} border transition-colors ${
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
                className={`app-checkbox flex items-center justify-center flex-shrink-0 transition-colors ${
                  isDone ? 'app-checkbox-checked' : 'hover:border-[var(--app-primary)]'
                }`}
                aria-label={isDone ? t('common.markAsNotDone') : t('common.markAsDone')}
              >
                {isDone && <Check className="w-3 h-3" />}
              </button>
            )}

            <div className="flex-1 min-w-0">
              <span className={`${calendarBlock ? 'text-[12px] font-bold' : compact ? 'text-xs font-medium' : 'text-sm font-medium'} block truncate ${
                isDone ? 'line-through text-neutral-400' : isFlagged ? 'text-red-900' : 'text-neutral-900'
              }`}>
                {task.title}
              </span>
            </div>

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

          {/* Line 2: attribute chips — always visible in collapsed and expanded read mode */}
          {(hasLabels || assignedUser || (!hideDateChip && dateStr) || subtaskCount > 0 || (task.priority && PRIORITY_COLORS[task.priority]) || !!task.repeatInterval || commentCount > 0) && (
            <div className={`flex flex-wrap items-center gap-1 mt-1.5 ml-0.5 ${compact && !showMenu ? 'max-h-7 overflow-hidden' : ''}`}>
              {taskLabelObjects.map((label) => (
                <AttributeChip
                  key={label.id}
                  icon={<Tag className="w-3.5 h-3.5" />}
                  label={label.name}
                  color={label.color}
                  active={isLabelFiltered(label.id)}
                  onClick={() => toggleChipFilter('label', label.id, label.name, label.color)}
                />
              ))}
              {assignedUser && (
                <AttributeChip
                  icon={<User className="w-3.5 h-3.5" />}
                  label={getCompactUserName(assignedUser)}
                  color={assigneeColor}
                  active={isAssigneeFiltered(assignedUser.id)}
                  onClick={() => toggleChipFilter('assignee', assignedUser.id, getCompactUserName(assignedUser), assigneeColor)}
                />
              )}
              {dateStr && !hideDateChip && (
                <AttributeChip
                  icon={<CalendarDays className="w-3.5 h-3.5" />}
                  label={dateStr}
                  color="#ea580c"
                  active={isDateFiltered(dateStr)}
                  onClick={() => toggleChipFilter('date', dateStr)}
                />
              )}
              {repeatLabel && (
                <AttributeChip
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  label={repeatChipLabel || repeatLabel}
                  color="#0f766e"
                  active={isRepeatFiltered(task.repeatInterval)}
                  onClick={() => task.repeatInterval && toggleChipFilter('repeat', task.repeatInterval, repeatLabel)}
                  maxWidthClassName="max-w-[92px]"
                />
              )}
              {commentCount > 0 && (
                <AttributeChip
                  icon={<MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />}
                  label={commentCount > 1 ? String(commentCount) : t('tasks.comment')}
                  color="#2563eb"
                />
              )}
              {subtaskCount > 0 && (
                <AttributeChip
                  icon={<SubtaskIcon className="w-3.5 h-3.5" />}
                  label={`${completedSubtaskCount}/${subtaskCount}`}
                  color="#8b5cf6"
                />
              )}
              {task.priority && PRIORITY_COLORS[task.priority] && (
                <AttributeChip
                  icon={<AlertTriangle className="w-3.5 h-3.5" />}
                  label={PRIORITY_LABELS[task.priority] || task.priority}
                  color={PRIORITY_COLORS[task.priority] || '#6b7280'}
                  onClick={() => toggleChipFilter('priority', task.priority, PRIORITY_LABELS[task.priority] || task.priority, PRIORITY_COLORS[task.priority] || '#6b7280')}
                />
              )}
            </div>
          )}

          {/* Expanded read-only section — no inline edit inputs/forms in list view */}
          {showMenu && (
            <div className="mt-2 border-t border-[var(--app-border-subtle)] pt-2">
              {subtaskCount > 0 && (
                <div className="mb-2 space-y-1">
                  {subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2 py-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (isSubtaskDone(subtask)) {
                            updateTask(subtask.id, { status: 'todo', completedAt: undefined });
                          } else {
                            updateTask(subtask.id, { status: 'done', completedAt: Date.now() });
                          }
                        }}
                        className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded border-2 ${
                          isSubtaskDone(subtask)
                            ? 'border-transparent bg-gradient-to-br from-emerald-500 to-cyan-500 text-white'
                            : 'border-neutral-300 bg-transparent'
                        }`}
                        aria-label={isSubtaskDone(subtask) ? t('tasks.markSubtaskAsNotDone') : t('tasks.markSubtaskAsDone')}
                      >
                        {isSubtaskDone(subtask) && <Check className="h-[11px] w-[11px]" strokeWidth={3} />}
                      </button>
                      <span className={`min-w-0 flex-1 truncate text-sm ${isSubtaskDone(subtask) ? 'text-[var(--app-text-muted)] line-through' : 'text-[var(--app-text)]'}`}>
                        {(subtask as any).title || (subtask as any).name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    showCompletionMessage(t('common.openEditor'));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border-subtle)] bg-[var(--app-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-muted)]"
                >
                  <Edit2 className="h-3 w-3" strokeWidth={2} />
                  {t('common.edit')}
                </button>
              </div>
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
