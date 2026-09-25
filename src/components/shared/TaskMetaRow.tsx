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
 * ATTRIBUUT-STANDAARD ronde 4 — verfijnd.
 * 
 * - Chip (pill, icon-leading + value): label, date, subtasks
 * - Clear icon (no chip, color = meaning): priority, comment
 * - Circle avatar: assignee — true circle, diameter = chip-height, always leftmost
 * - All same height/baseline, tap = picker. One shared component.
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

  // Consistent chip-height = h-7 (28px)
  const iconBtnClass = 'inline-flex items-center justify-center flex-shrink-0 transition-transform active:scale-95';
  const iconLabel = 'text-[11px] font-medium leading-none';

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-0.5" data-component="TaskMetaRow">

      {/* ── 1. Assignee — true circle avatar, always leftmost ── */}
      {assignee && (
        <button
          onClick={onAssigneeClick}
          className={`${iconBtnClass} h-7 w-7 rounded-full text-[11px] font-bold text-white leading-none ${
            isAssigneeFiltered ? 'ring-1.5 ring-offset-1' : ''
          }`}
          style={{
            backgroundColor: assignee.color,
            minWidth: '28px',
            maxWidth: '28px',
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

      {/* ── 2. Labels — chip with tag icon + name ── */}
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

      {/* ── 3. Date — chip: calendar icon + date ── */}
      {dateStr && (
        <AttributeChip
          icon={<CalendarDays className="w-3 h-3" />}
          label={dateStr}
          color={isOverdue ? '#ea580c' : '#6b7280'}
          active={isDateFiltered}
          onClick={onDateClick}
        />
      )}

      {/* ── 4. Priority — clear standalone icon, color per level ── */}
      {priority && PRIORITY_COLORS[priority] && (
        <button
          onClick={onPriorityClick}
          className={`${iconBtnClass} h-7 w-7`}
          title={PRIORITY_LABELS[priority] || priority}
          aria-label={`${t('tasks.priority')}: ${PRIORITY_LABELS[priority] || priority}`}
        >
          <PriorityIcon priority={priority as any} size={16} />
        </button>
      )}

      {/* ── 5. Subtasks — chip with square-dot icon + progress ── */}
      {subtaskCount > 0 && (
        <AttributeChip
          icon={<SubtaskIcon className="w-3 h-3" />}
          label={`${completedSubtaskCount}/${subtaskCount}`}
          color="#8b5cf6"
          onClick={onSubtaskClick}
        />
      )}

      {/* ── 6. Comment — clear standalone icon, optional count ── */}
      {hasComment && (
        <button
          type="button"
          onClick={onCommentClick}
          className={`${iconBtnClass} gap-0.5 ${iconLabel} text-blue-500`}
          aria-label={t('tasks.comment')}
          title={t('tasks.comment')}
        >
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
          {commentCount && commentCount > 0 ? (
            <span className="text-[11px] font-semibold">{commentCount}</span>
          ) : null}
        </button>
      )}

      {/* ── Repeat — compact chip (after comment) ── */}
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
