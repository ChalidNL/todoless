import React from 'react';
import { CalendarDays, MessageSquare } from 'lucide-react';
import { t, formatDate } from '../../i18n/translations';
import { AttributeChip } from './AttributeChip';
import { PriorityIcon } from '../../lib/PriorityIcon';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/priority';
import { getRepeatChipLabel, getRepeatLabel } from '../../lib/repeat-options';
import { RotateCcw } from 'lucide-react';

// Subtask icon
const SubtaskIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="8" r="2.5" fill="currentColor" />
  </svg>
);

export interface MetaRowData {
  labels: Array<{ id: string; name: string; color: string }>;
  assignee: { name: string; color: string; avatarUrl?: string; id: string } | null;
  dateStr: string | null;
  isOverdue: boolean;
  repeatLabel: string | null;
  repeatChipLabel: string | null;
  repeatInterval: string | null;
  hasComment: boolean;
  subtaskCount: number;
  completedSubtaskCount: number;
  priority: string | null;
}

interface TaskMetaRowProps {
  data: MetaRowData;
  expanded: boolean;
  /** Theme color for the screen (e.g. green for Tasks, blue for Inbox) */
  themeColor?: string;
  // Handlers (when expanded, use remove/clear; when collapsed, use filter toggle)
  onLabelClick: (labelId: string) => void;
  onAssigneeClick: () => void;
  onDateClick: () => void;
  onRepeatClick: () => void;
  onCommentClick: () => void;
  onSubtaskClick: () => void;
  onPriorityClick: () => void;
  // Filter state hooks
  isLabelFiltered: (id: string) => boolean;
  isAssigneeFiltered: boolean;
  isDateFiltered: boolean;
  isRepeatFiltered: boolean;
}

/** Shared compact meta row — consistent sizing across collapsed + expanded, all screens */
export const TaskMetaRow = React.memo(function TaskMetaRow({
  data,
  expanded,
  themeColor = '#22c55e',
  onLabelClick, onAssigneeClick, onDateClick, onRepeatClick, onCommentClick, onSubtaskClick, onPriorityClick,
  isLabelFiltered, isAssigneeFiltered, isDateFiltered, isRepeatFiltered,
}: TaskMetaRowProps) {
  const {
    labels, assignee, dateStr, isOverdue,
    repeatLabel, repeatChipLabel,
    hasComment, subtaskCount, completedSubtaskCount,
    priority,
  } = data;

  const hasAny = labels.length > 0 || assignee || dateStr || subtaskCount > 0 ||
    (priority && PRIORITY_COLORS[priority]) || repeatLabel || hasComment;

  if (!hasAny) return null;

  /** Consistent meta height */
  const metaClass = 'inline-flex items-center gap-1 text-[11px] font-medium leading-none';

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-0.5" data-component="TaskMetaRow">
      {/* Labels — AttributeChip (compact, h-6) */}
      {labels.map((label) => (
        <AttributeChip
          key={label.id}
          label={label.name}
          color={label.color}
          active={isLabelFiltered(label.id)}
          onClick={() => onLabelClick(label.id)}
          compact={false}
        />
      ))}

      {/* Assignee — small round avatar */}
      {assignee && (
        <button
          onClick={onAssigneeClick}
          className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white transition-transform active:scale-95 ${
            isAssigneeFiltered ? 'ring-1.5 ring-offset-1' : ''
          }`}
          style={{
            backgroundColor: assignee.color,
            ...(isAssigneeFiltered ? { ringColor: assignee.color } as React.CSSProperties : {}),
          }}
          title={assignee.name}
          aria-label={`${t('tasks.assignee')}: ${assignee.name}`}
        >
          {assignee.avatarUrl ? (
            <img src={assignee.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            assignee.name.charAt(0).toUpperCase()
          )}
        </button>
      )}

      {/* Date — subtle inline, overdue gets orange tint */}
      {dateStr && (
        <span
          onClick={onDateClick}
          className={`${metaClass} cursor-pointer ${isOverdue ? 'text-orange-500' : 'text-neutral-400'}`}
          style={isDateFiltered ? { color: '#ea580c', fontWeight: 600 } : undefined}
        >
          <CalendarDays className="w-3 h-3 flex-shrink-0" />
          {dateStr}
        </span>
      )}

      {/* Comment — consistent size with count */}
      {hasComment && (
        <button
          type="button"
          onClick={onCommentClick}
          className={`${metaClass} cursor-pointer text-blue-500 hover:text-blue-600`}
          aria-label={t('tasks.comment')}
          title={t('tasks.comment')}
        >
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
        </button>
      )}

      {/* Subtasks — compact chip */}
      {subtaskCount > 0 && (
        <AttributeChip
          icon={<SubtaskIcon className="w-3 h-3" />}
          label={`${completedSubtaskCount}/${subtaskCount}`}
          color="#8b5cf6"
          onClick={onSubtaskClick}
        />
      )}

      {/* Priority — icon only */}
      {priority && PRIORITY_COLORS[priority] && (
        <button
          onClick={onPriorityClick}
          className="inline-flex items-center justify-center"
          title={PRIORITY_LABELS[priority] || priority}
          aria-label={`${t('tasks.priority')}: ${PRIORITY_LABELS[priority] || priority}`}
        >
          <PriorityIcon priority={priority as any} size={14} />
        </button>
      )}

      {/* Repeat — compact chip */}
      {repeatLabel && (
        <AttributeChip
          icon={<RotateCcw className="w-3 h-3" />}
          label={repeatChipLabel || repeatLabel}
          color="#0f766e"
          active={isRepeatFiltered}
          onClick={onRepeatClick}
          maxWidthClassName="max-w-[72px]"
        />
      )}
    </div>
  );
});
