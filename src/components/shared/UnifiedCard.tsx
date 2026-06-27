import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task, Item, userDisplayName, Priority, RepeatInterval } from '../../types';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/pocketbase-client';
import { Check, ChevronDown, ChevronUp, Trash2, Tag, User, CalendarDays, Flag, ShoppingCart, ArrowLeftRight, X, AlertTriangle, RotateCcw, Inbox, MessageSquare, Target } from 'lucide-react';
import { t, formatDate } from '../../i18n/translations';
import { getRepeatChipLabel, getRepeatLabel, getRepeatOptions } from '../../lib/repeat-options';
import { getCompactUserName } from '../../lib/member-role-utils';
import { combineLocalDateAndTime, formatLocalDateInputValue, formatLocalTimeInputValue, parseLocalDateInputValue } from '../../lib/date-local';
import { sortLabelsByVisibility } from '../../lib/label-utils';

// Subtask icon: square with dot inside
const SubtaskIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="8" r="2.5" fill="currentColor" />
  </svg>
);
import { LabelBadge } from './LabelBadge';
import { AttributeChip } from './AttributeChip';
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ORDER } from '../../lib/priority';
import { entityColor, entityBg } from '../../lib/entity-colors';

interface UnifiedCardProps {
  entity: Task | Item;
  type: 'task' | 'item';
}

type UnifiedEditor = 'labels' | 'assignee' | 'schedule' | 'shop' | 'priority' | null;

export const UnifiedCard = ({ entity, type }: UnifiedCardProps) => {
  const { updateTask, updateItem, deleteTask, deleteItem, labels, users, shops, tasks, addLabel, addShop, toggleChipFilter, isChipFilterActive, swapEntity, refreshEntries, showCompletionMessage, moveTaskToStatus } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [activeEditor, setActiveEditor] = useState<UnifiedEditor>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [shopInput, setShopInput] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');

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

  const isTask = type === 'task';
  const task = isTask ? (entity as Task) : null;
  const item = !isTask ? (entity as Item) : null;

  const isDone = isTask ? task!.status === 'done' : item!.completed;
  const isTaskFlagged = isTask && task!.flag && !isDone;
  const isOverdue = !!entity.dueDate && entity.dueDate < Date.now() && !isDone;
  const quantity = item?.quantity ?? 1;
  const currentShop = item?.shopId ? shops.find(s => s.id === item.shopId) : null;
  const assignedUser = entity.assignedTo ? users.find(u => u.id === entity.assignedTo) : null;
  const assigneeColor = assignedUser ? entityColor(assignedUser.id) : undefined;
  const dateStr = entity.dueDate ? formatDate(entity.dueDate, { month: 'short', day: 'numeric' }) : null;
  const repeatLabel = task?.repeatInterval ? getRepeatLabel(task.repeatInterval, task.dueDate) : null;
  const repeatChipLabel = task?.repeatInterval ? getRepeatChipLabel(task.repeatInterval, task.dueDate) : null;
  const hasTaskComment = !!task?.blockedComment?.trim();
  const isItemFocused = !!item?.focus && !isDone;
  const isFocusHighlighted = (isTask ? !!task?.focus : !!item?.focus) && !isDone;

  const handleToggle = () => {
    if (isTask) {
      updateTask(entity.id, task!.status === 'done' ? { status: 'todo', completedAt: undefined } : { status: 'done', completedAt: Date.now() });
    } else {
      updateItem(entity.id, { completed: !item!.completed });
    }
  };

  const handleDelete = () => {
    if (isTask) deleteTask(entity.id);
    else deleteItem(entity.id);
  };

  const setValue = (val: Record<string, unknown>) => {
    if (isTask) updateTask(entity.id, val);
    else updateItem(entity.id, val);
  };

  const handleToggleFlag = () => {
    if (isTask) updateTask(entity.id, { flag: !task!.flag, blocked: !task!.flag });
  };

  const setQuantity = (next: number) => {
    if (item) updateItem(item.id, { quantity: Math.max(0, next) });
  };

  const isShopFiltered = (id?: string) => id ? isChipFilterActive('shop', id) : false;

  const hasLabels = isTask && entity.labels.length > 0;
  const hasAssignee = isTask && !!entity.assignedTo;
  const hasShop = !!currentShop;

  const visibleShops = shops.filter((shop) => shop.name.toLowerCase().includes(shopInput.toLowerCase()));

  // Subtasks (tasks only)
  const subtasks: Task[] = isTask && (task as Task).subtaskIds
    ? (task as Task).subtaskIds!.map(id => tasks.find(t => t.id === id)).filter(Boolean) as Task[]
    : [];
  const subtaskCount = subtasks.length;
  const completedSubtaskCount = subtasks.filter(s => s.status === 'done').length;

  return (
    <div
      ref={cardRef}
      onClick={trackInteraction}
      className={`rounded-lg border transition-colors ${
        isDone
          ? 'border-neutral-200 opacity-75'
          : isFocusHighlighted
            ? isTask
              ? 'border-violet-500 hover:border-violet-600 shadow-[0_0_0_1px_rgba(124,58,237,0.18)]'
              : 'border-orange-400 hover:border-orange-500 shadow-[0_0_0_1px_rgba(249,115,22,0.14)]'
            : 'border-neutral-200 hover:border-neutral-300'
      } ${
        isTaskFlagged
          ? '!bg-red-50'
          : isOverdue
            ? '!bg-orange-50'
            : isFocusHighlighted
              ? isTask
                ? '!bg-violet-200/70'
                : '!bg-orange-50'
              : 'bg-white'
      } ${showMenu ? 'ring-1 ring-neutral-300 !bg-neutral-50' : ''}`}>
      <div className="p-2.5">
        {/* Line 1: checkbox + title + badge(s) + hamburger */}
        <div className="flex items-center gap-2">
          {/* Checkbox (button) */}
          <button
            onClick={handleToggle}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              isDone
                ? 'bg-neutral-900 border-neutral-900 text-white'
                : 'border-neutral-300 hover:border-neutral-500'
            }`}
            aria-label={isDone ? t('common.markAsNotDone') : t('common.markAsDone')}
          >
            {isDone && <Check className="w-3 h-3" />}
          </button>

          {/* Title */}
          {showMenu ? (
            <input
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                const trimmed = titleDraft.trim();
                if (trimmed && trimmed !== entity.title) {
                  setValue({ title: trimmed });
                } else if (!trimmed) {
                  setTitleDraft(entity.title);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  setTitleDraft(entity.title);
                }
              }}
              autoFocus
              className={`text-sm font-medium flex-1 min-w-0 px-1.5 py-0.5 border border-neutral-300 rounded bg-white ${
                isDone ? 'line-through text-neutral-400' : 'text-neutral-900'
              }`}
              aria-label={t('common.editTitle')}
            />
          ) : (
          <span className={`text-sm font-medium flex-1 truncate ${
            isDone ? 'line-through text-neutral-400' : 'text-neutral-900'
          }`}>
            {entity.title}
          </span>
          )}

          {/* Flag badge (tasks) */}
          {isTask && task!.flag && (
            <Flag className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
          )}

          {/* Quantity [+][-] controls (items) — replaces static badge */}
          {!isTask && !isDone && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => setQuantity(quantity - 1)}
                className="w-6 h-6 text-xs border border-neutral-200 rounded hover:bg-neutral-50 text-neutral-700"
                aria-label={t('items.decreaseQuantity')}
              >
                -
              </button>
              <span className="text-xs font-medium text-neutral-600 border border-neutral-200 rounded px-2 py-0.5 min-w-[28px] text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-6 h-6 text-xs border border-neutral-200 rounded hover:bg-neutral-50 text-neutral-700"
                aria-label={t('items.increaseQuantity')}
              >
                +
              </button>
            </div>
          )}

          {/* Expander */}
          <button
            onClick={() => {
              setShowMenu(!showMenu);
              setActiveEditor(null);
              if (!showMenu) setTitleDraft(entity.title);
            }}
            className="p-1 hover:bg-neutral-100 rounded transition-colors flex-shrink-0"
            aria-label={showMenu ? t('common.closeEditor') : t('common.openEditor')}
          >
            {showMenu ? <ChevronUp className="w-4 h-4 text-neutral-600" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
          </button>
        </div>

        {/* Chip row — labels + assignee + shop + date (only when not done) */}
        {/* Tasks: chips visible in both collapsed and edit mode (labels+assignee always visible) */}
        {/* Items: chips always visible */}
        {!isDone && ((isTask && (hasLabels || assignedUser || dateStr || subtaskCount > 0 || (entity.priority && PRIORITY_COLORS[entity.priority as Priority]) || !!task?.repeatInterval || hasTaskComment)) || (!isTask && hasShop)) && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5 ml-0.5">
            {isTask && entity.labels.map(labelId => {
              const label = labels.find(l => l.id === labelId);
              return label ? (
                <AttributeChip
                  key={label.id}
                  icon={<Tag className="w-3.5 h-3.5" />}
                  label={label.name}
                  color={label.color}
                  active={isChipFilterActive('label', label.id)}
                  onClick={showMenu ? () => setValue({ labels: (entity.labels as string[]).filter(id => id !== label.id) }) : () => toggleChipFilter('label', label.id, label.name, label.color)}
                />
              ) : null;
            })}
            {isTask && assignedUser && (
              <AttributeChip
                icon={<User className="w-3.5 h-3.5" />}
                label={getCompactUserName(assignedUser)}
                color={assigneeColor}
                active={isChipFilterActive('assignee', assignedUser.id)}
                onClick={showMenu ? () => setValue({ assignedTo: null }) : () => toggleChipFilter('assignee', assignedUser.id, getCompactUserName(assignedUser), assigneeColor)}
              />
            )}
            {isTask && dateStr && (
              <AttributeChip
                icon={<CalendarDays className="w-3.5 h-3.5" />}
                label={dateStr}
                color="#ea580c"
                onClick={showMenu ? () => setValue({ dueDate: null, repeatInterval: null }) : () => toggleChipFilter('date', dateStr)}
              />
            )}
            {isTask && repeatLabel && (
              <AttributeChip
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                label={repeatChipLabel || repeatLabel}
                color="#0f766e"
                active={!!task?.repeatInterval && isChipFilterActive('repeat', task.repeatInterval)}
                onClick={showMenu ? () => setValue({ dueDate: null, repeatInterval: null }) : () => task?.repeatInterval && toggleChipFilter('repeat', task.repeatInterval, repeatLabel)}
                maxWidthClassName="max-w-[92px]"
              />
            )}
            {isTask && hasTaskComment && (
              <button
                type="button"
                onClick={() => setActiveEditor('comment')}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
                aria-label={t('tasks.comment')}
                title={t('tasks.comment')}
              >
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
            {currentShop && (
              <AttributeChip
                icon={<ShoppingCart className="w-3.5 h-3.5" />}
                label={currentShop.name}
                color={currentShop.color}
                active={isShopFiltered(currentShop.id)}
                onClick={showMenu ? () => setValue({ shopId: null }) : () => toggleChipFilter('shop', currentShop.id, currentShop.name, currentShop.color)}
              />
            )}
            {isTask && subtaskCount > 0 && (
              <AttributeChip
                icon={<SubtaskIcon className="w-3.5 h-3.5" />}
                label={`${completedSubtaskCount}/${subtaskCount}`}
                color="#8b5cf6"
              />
            )}
            {isTask && entity.priority && PRIORITY_COLORS[entity.priority as Priority] && (
              <AttributeChip
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                label={PRIORITY_LABELS[entity.priority as Priority] || entity.priority}
                color={PRIORITY_COLORS[entity.priority as Priority] || '#6b7280'}
                onClick={showMenu ? () => setValue({ priority: null }) : () => toggleChipFilter('priority', entity.priority!, PRIORITY_LABELS[entity.priority as Priority] || entity.priority, PRIORITY_COLORS[entity.priority as Priority] || '#6b7280')}
              />
            )}
          </div>
        )}

        {/* Subtasks list (tasks only) — visible when card is expanded */}{isTask && showMenu && subtaskCount > 0 && (
          <div className="mt-2 pt-2 border-t border-neutral-100 space-y-1.5">
            <div className="px-1">
              <span className="text-xs font-medium text-neutral-500">{t('tasks.subtasks')} ({subtaskCount})</span>
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
                  aria-label={subtask.status === 'done' ? t('tasks.markSubtaskAsNotDone') : t('tasks.markSubtaskAsDone')}
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
        {/* Add subtask input (tasks only) — only when card is expanded */}
        {isTask && showMenu && (
          <div className={`${subtaskCount > 0 ? 'mt-2' : 'mt-2 pt-2 border-t border-neutral-100'}`}>
            <div className="flex items-center gap-1.5 pl-2">
              <input
                type="text"
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const title = subtaskTitle.trim();
                    if (!title) return;
                    try {
                      await api.createSubtask(title, task!.id);
                      setSubtaskTitle('');
                      await refreshEntries();
                      showCompletionMessage(t('tasks.subtaskAdded'));
                    } catch (err: any) {
                      showCompletionMessage(err.message || t('tasks.failedToCreateSubtask'));
                    }
                  }
                }}
                placeholder={t('tasks.newSubtaskTitle')}
                className="flex-1 text-xs px-2 py-1.5 border border-neutral-200 rounded bg-white"
                aria-label={t('tasks.newSubtaskTitle')}
              />
              <button
                onClick={async () => {
                  const title = subtaskTitle.trim();
                  if (!title) return;
                  try {
                    await api.createSubtask(title, task!.id);
                    setSubtaskTitle('');
                    await refreshEntries();
                    showCompletionMessage(t('tasks.subtaskAdded'));
                  } catch (err: any) {
                    showCompletionMessage(err.message || t('tasks.failedToCreateSubtask'));
                  }
                }}
                className="px-2 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
                aria-label={t('tasks.addSubtask')}
              >
                {t('common.add')}
              </button>
            </div>
          </div>
        )}

        {/* Line 2: attributes behind hamburger */}
        {showMenu && (
          <div className="mt-2 pt-2 border-t border-neutral-100">
            {/* Attribute buttons */}
            <div className="flex items-center gap-2">
              {isTask && (
                <button
                  onClick={() => setActiveEditor(activeEditor === 'labels' ? null : 'labels')}
                  className={`p-1.5 rounded transition-colors ${activeEditor === 'labels' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title={t('tasks.labelTooltip')}
                  aria-label={t('tasks.editLabels')}
                >
                  <Tag className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {isTask && (
                <button
                  onClick={() => setActiveEditor(activeEditor === 'assignee' ? null : 'assignee')}
                  className={`p-1.5 rounded transition-colors ${activeEditor === 'assignee' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title={t('tasks.assigneeTooltip')}
                  aria-label={t('tasks.editAssignee')}
                >
                  <User className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {isTask && (
                <button
                  onClick={() => setActiveEditor(activeEditor === 'schedule' ? null : 'schedule')}
                  className={`p-1.5 rounded transition-colors ${activeEditor === 'schedule' ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title={t('tasks.scheduleTooltip')}
                  aria-label={t('tasks.editSchedule')}
                >
                  <CalendarDays className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {isTask && (
                <button
                  onClick={() => setShowMenu(true)}
                  className={`p-1.5 rounded transition-colors ${
                    subtaskCount > 0 || showMenu
                      ? 'bg-purple-100 text-purple-700'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title={t('tasks.subtasksTooltip')}
                  aria-label={t('tasks.viewSubtasks')}
                >
                  <SubtaskIcon className="w-4 h-4" />
                </button>
              )}
              {isTask && (
                <button
                  onClick={() => setActiveEditor(activeEditor === 'priority' ? null : 'priority')}
                  className={`p-1.5 rounded transition-colors ${
                    (entity.priority && PRIORITY_COLORS[entity.priority as Priority]) || activeEditor === 'priority'
                      ? 'text-white'
                      : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  style={
                    (entity.priority && PRIORITY_COLORS[entity.priority as Priority]) || activeEditor === 'priority'
                      ? { backgroundColor: entity.priority ? PRIORITY_COLORS[entity.priority as Priority] : '#f59e0b' }
                      : undefined
                  }
                  title={t('tasks.priority')}
                  aria-label={t('tasks.editPriority')}
                >
                  <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {isTask && (
                <button
                  onClick={() => setValue({ focus: !task!.focus })}
                  className={`p-1.5 rounded transition-colors ${
                    task!.focus ? 'bg-orange-100 text-orange-700' : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title={t('tasks.focus')}
                  aria-label={t('tasks.focus')}
                >
                  <Target className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {isTask && (
                <button
                  onClick={handleToggleFlag}
                  className={`p-1.5 rounded transition-colors ${task!.flag ? 'bg-red-200 text-red-700' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title={t('tasks.flagTooltip')}
                  aria-label={t('tasks.toggleFlag')}
                >
                  <Flag className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {!isTask && (
                <button
                  onClick={() => {
                    const next = activeEditor === 'shop' ? null : 'shop';
                    setActiveEditor(next);
                    if (next) setShopInput('');
                  }}
                  className={`p-1.5 rounded transition-colors ${hasShop || activeEditor === 'shop' ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'hover:bg-neutral-100 text-neutral-500'}`}
                  title={t('items.selectShopTooltip')}
                  aria-label={t('items.selectShopTooltip')}
                >
                  <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {!isTask && (
                <button
                  onClick={() => setValue({ focus: !item!.focus })}
                  className={`p-1.5 rounded transition-colors ${
                    isItemFocused ? 'bg-orange-100 text-orange-700' : 'hover:bg-neutral-100 text-neutral-500'
                  }`}
                  title={t('tasks.focus')}
                  aria-label={t('tasks.focus')}
                >
                  <Target className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              <div className="flex-1" />
              {isTask && task!.status !== 'backlog' && (
                <button
                  onClick={() => { moveTaskToStatus(entity.id, 'backlog'); showCompletionMessage(t('tasks.movedToBacklog')); }}
                  className="p-1.5 rounded transition-colors hover:bg-blue-50 text-blue-500"
                  title={t('tasks.moveToBacklog') || 'Move to Backlog'}
                  aria-label={t('tasks.moveToBacklog') || 'Move to Backlog'}
                >
                  <Inbox className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              <button
                onClick={() => swapEntity(entity.id)}
                className="p-1.5 rounded transition-colors hover:bg-neutral-100 text-neutral-400"
                title={t('common.swapType')}
                aria-label={t('common.swapType')}
              >
                <ArrowLeftRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded text-red-600 hover:bg-red-50"
                title={t('common.delete')}
                aria-label={t('common.delete')}
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Label editor */}
            {activeEditor === 'labels' && (
              <div className="mt-2 p-2 bg-neutral-50 rounded space-y-1.5">
                <input
                  type="text"
                  onChange={(e) => {
                    const name = e.target.value.trim();
                    if (!name) return;
                    const existing = labels.find(l => l.name.toLowerCase() === name.toLowerCase());
                    if (existing) {
                      if (!entity.labels.includes(existing.id)) {
                        setValue({ labels: [existing.id], labelId: existing.id });
                      }
                    } else {
                      addLabel({ name, color: '#3b82f6', visibility: 'family', isPrivate: false, sharedWith: [] });
                    }
                    e.target.value = '';
                  }}
                  placeholder={t('tasks.labelInputPlaceholder')}
                  className="w-full text-sm px-2 py-1.5 border border-neutral-200 rounded"
                  aria-label={t('tasks.labelInputAria')}
                />
                <div className="flex flex-wrap gap-1">
                  {sortLabelsByVisibility(labels).map(label => (
                    <button
                      key={label.id}
                      onClick={() => {
                        const has = entity.labels.includes(label.id);
                        setValue({ labels: has ? [] : [label.id], labelId: has ? null : label.id });
                      }}
                      className={entity.labels.includes(label.id) ? 'ring-2 ring-neutral-900 rounded' : ''}
                    >
                      <LabelBadge label={label} size="sm" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule editor */}
            {activeEditor === 'schedule' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={formatLocalDateInputValue(entity.dueDate)}
                  onChange={(e) => setValue({ dueDate: e.target.value ? (combineLocalDateAndTime(e.target.value, formatLocalTimeInputValue(entity.dueDate) || '00:00') ?? parseLocalDateInputValue(e.target.value)) : null })}
                  className="text-sm px-2 py-1.5 border border-neutral-200 rounded flex-1"
                  aria-label={t('tasks.dueDateAria')}
                />
                <input
                  type="time"
                  value={formatLocalTimeInputValue(entity.dueDate)}
                  onChange={(e) => {
                    const dateVal = formatLocalDateInputValue(entity.dueDate);
                    if (!dateVal) return;
                    setValue({ dueDate: combineLocalDateAndTime(dateVal, e.target.value || '00:00') });
                  }}
                  className="text-sm px-2 py-1.5 border border-neutral-200 rounded"
                  aria-label={t('tasks.dueTimeAria')}
                />
                {isTask && (
                  <select
                    value={task?.repeatInterval || ''}
                    onChange={(e) => setValue({ repeatInterval: (e.target.value || null) as RepeatInterval | null })}
                    className="w-44 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                    aria-label={t('tasks.recurringIntervalAria')}
                  >
                    {getRepeatOptions(task?.dueDate).map((option) => (
                      <option key={option.value || 'none'} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Assignee editor */}
            {activeEditor === 'assignee' && (
              <div className="mt-2 relative">
                <input
                  type="text"
                  onChange={(e) => {
                    const q = e.target.value.toLowerCase();
                    const match = users.find(u => getCompactUserName(u).toLowerCase().includes(q) || userDisplayName(u).toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
                    if (match && e.target.value.length > 0) {
                      setValue({ assignedTo: match.id });
                      setActiveEditor(null);
                    }
                    if (!e.target.value) {
                      setValue({ assignedTo: null });
                    }
                  }}
                  placeholder={t('tasks.searchAssigneePlaceholder')}
                  className="w-full text-sm px-2 py-1.5 border border-neutral-200 rounded"
                  aria-label={t('tasks.searchAssigneeAria')}
                />
              </div>
            )}

            {/* Shop editor (items only) — text-input-first like GroceryCard */}
            {activeEditor === 'shop' && !isTask && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={shopInput}
                    onChange={(e) => setShopInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const name = shopInput.trim();
                        if (!name) return;
                        const existing = shops.find((s) => s.name.toLowerCase() === name.toLowerCase());
                        if (existing) {
                          setValue({ shopId: existing.id });
                        } else {
                          addShop({ name, color: '#10b981' });
                        }
                        setShopInput('');
                      }
                    }}
                    placeholder={t('items.shopInputPlaceholder')}
                    className="flex-1 text-sm px-2 py-1.5 border border-neutral-200 rounded"
                    aria-label={t('items.shopInputAria')}
                  />
                  {hasShop && (
                    <button
                      onClick={() => setValue({ shopId: null })}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded text-sm"
                      aria-label={t('items.clearShop')}
                      title={t('common.clearAllTooltip')}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {visibleShops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => setValue({ shopId: item!.shopId === shop.id ? null : shop.id })}
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-xs font-normal leading-none border ${
                          item!.shopId === shop.id ? 'ring-2 ring-neutral-900' : 'hover:border-neutral-400'
                        }`}
                        style={{
                          backgroundColor: item!.shopId === shop.id ? `${shop.color || '#10b981'}20` : undefined,
                          color: item!.shopId === shop.id ? shop.color || '#10b981' : undefined,
                          borderColor: item!.shopId === shop.id ? `${shop.color || '#10b981'}40` : '#e5e7eb',
                        }}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {shop.name}
                      </span>
                    </button>
                  ))}
                  {visibleShops.length === 0 && (
                    <p className="text-xs text-neutral-400 italic">{t('items.noShopsFound')}</p>
                  )}
                </div>
              </div>
            )}

            {/* Priority editor */}
            {activeEditor === 'priority' && (
              <div className="mt-2">
                <div className="flex items-center gap-1.5">
                  {PRIORITY_ORDER.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setValue({ priority: p });
                        setActiveEditor(null);
                      }}
                      className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                        entity.priority === p
                          ? 'text-white shadow-sm'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                      style={entity.priority === p ? { backgroundColor: PRIORITY_COLORS[p] } : undefined}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
