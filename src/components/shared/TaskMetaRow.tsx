import React from 'react';
import { CalendarDays, MessageSquare, Tag, RotateCcw } from 'lucide-react';
import { t } from '../../i18n/translations';
import { AttributeChip } from './AttributeChip';
import { PriorityIcon } from '../../lib/PriorityIcon';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/priority';

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
  commentCount?: number;
  subtaskCount: number;
  completedSubtaskCount: number;
  priority: string | null;
}

interface TaskMetaRowProps {
  data: MetaRowData;
  expanded: boolean;
  themeColor?: string;
  onLabelClick: (labelId: string) => void;
  onAssigneeClick: () => void;
  onDateClick: () => void;
  onRepeatClick: () => void;
  onCommentClick: () => void;
  onSubtaskClick: () => void;
  onPriorityClick: () => void;
  isLabelFiltered: (id: string) => boolean;
  isAssigneeFiltered: boolean;
  isDateFiltered: boolean;
  isRepeatFiltered: boolean;
}

/**
 * ATTRIBUUT-STANDAARD — shared meta row for all task attributes.
 * 
 * Rule: every attribute is a chip (pill) with tinted background, icon-leading, chip height.
 * Exception: assignee = round avatar, but matched to chip height (h-7).
 * Consistent across compact + expanded, all screens.
 */
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
    hasComment, commentCount, subtaskCount, completedSubtaskCount,
    priority,
  } = data;

  const hasAny = labels.length > 0 || assignee || dateStr || subtaskCount > 0 ||
    (priority && PRIORITY_COLORS[priority]) || repeatLabel || hasComment;

  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-0.5" data-component="TaskMetaRow">
      {/* Labels — chip with tag icon + name */}
      {labels.map((label) => (
        <AttributeChip
          key={label.id}
          icon={<Tag className="w-3 h-3" />}
          label={label.name}
          color={label.color}
          active={isLabelFiltered(label.id)}
          onClick={() => onLabelClick(label.id)}
        />
      ))}

      {/* Assignee — round avatar, height = chip height (h-7 = 28px) */}
      {assignee && (
        <button
          onClick={onAssigneeClick}
          className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white transition-transform active:scale-95 ${
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

      {/* Date — back in chip: calendar icon + date, overdue = orange tint */}
      {dateStr && (
        <AttributeChip
          icon={<CalendarDays className="w-3 h-3" />}
          label={dateStr}
          color={isOverdue ? '#ea580c' : '#6b7280'}
          active={isDateFiltered}
          onClick={onDateClick}
        />
      )}

      {/* Comment — chip with message-square icon + optional count */}
      {hasComment && (
        <AttributeChip
          icon={<MessageSquare className="w-3 h-3" strokeWidth={1.75} />}
          label={commentCount && commentCount > 0 ? `${commentCount}` : ''}
          color="#3b82f6"
          onClick={onCommentClick}
        />
      )}

      {/* Subtasks — chip with square-dot icon + progress */}
      {subtaskCount > 0 && (
        <AttributeChip
          icon={<SubtaskIcon className="w-3 h-3" />}
          label={`${completedSubtaskCount}/${subtaskCount}`}
          color="#8b5cf6"
          onClick={onSubtaskClick}
        />
      )}

      {/* Priority — icon in chip-height container, color per level */}
      {priority && PRIORITY_COLORS[priority] && (
        <button
          onClick={onPriorityClick}
          className="inline-flex items-center justify-center h-7 w-7 rounded-full transition-transform active:scale-95"
          title={PRIORITY_LABELS[priority] || priority}
          aria-label={`${t('tasks.priority')}: ${PRIORITY_LABELS[priority] || priority}`}
        >
          <PriorityIcon priority={priority as any} size={15} />
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
