import React from 'react';
import { Tag, User, CalendarDays, AlertTriangle, Target, MessageSquare, Flag, MoreHorizontal, Trash2 } from 'lucide-react';
import { t } from '../../i18n/translations';
import { PRIORITY_COLORS } from '../../lib/priority';

// Subtask icon
const SubtaskIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="8" r="2.5" fill="currentColor" />
  </svg>
);

interface ActionButton {
  key: string;
  label: string;
  ariaLabel: string;
  Icon: React.ComponentType<any>;
  /** Is this attribute currently set? */
  isSet: boolean;
  /** Color when set (the attribute's own color) */
  color?: string;
  /** Color when unset (defaults to neutral gray) */
  onClick: () => void;
  active?: boolean;
}

interface TaskActionBarProps {
  buttons: {
    label: ActionButton;
    assignee: ActionButton;
    schedule: ActionButton;
    subtask: ActionButton;
    priority: ActionButton;
    focus: ActionButton;
    comment: ActionButton;
    flag: ActionButton;
    more: ActionButton;
    delete: ActionButton;
  };
  /** Theme color for active editor states */
  themeColor?: string;
  /** For special "others" editor indicator */
  activeEditor?: string | null;
}

/**
 * Shared action bar for expanded task cards.
 * Color = status: set attributes light up in their own color, unset = neutral gray.
 * "Kleur vertelt wat ingevuld is — rustiger en informatiever."
 */
export const TaskActionBar = React.memo(function TaskActionBar({
  buttons,
  themeColor = '#22c55e',
  activeEditor,
}: TaskActionBarProps) {
  const renderButton = (b: ActionButton) => {
    const btnClass = `p-1.5 rounded transition-all duration-150 ${
      b.isSet || b.active
        ? ''
        : 'hover:bg-neutral-100 text-neutral-400'
    }`;

    return (
      <button
        key={b.key}
        onClick={b.onClick}
        className={btnClass}
        style={b.isSet ? { color: b.color || themeColor, background: `${b.color || themeColor}12` } : undefined}
        title={b.label}
        aria-label={b.ariaLabel}
      >
        {b.key === 'subtask' ? (
          <SubtaskIcon className="w-4 h-4" />
        ) : (
          <b.Icon className="w-4 h-4" strokeWidth={1.75} />
        )}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1.5" data-component="TaskActionBar">
      {renderButton(buttons.label)}
      {renderButton(buttons.assignee)}
      {renderButton(buttons.schedule)}
      {renderButton(buttons.subtask)}
      {renderButton(buttons.priority)}
      {renderButton(buttons.focus)}
      {renderButton(buttons.comment)}
      {renderButton(buttons.flag)}
      {renderButton(buttons.more)}
      <div className="flex-1" />
      {renderButton(buttons.delete)}
    </div>
  );
});
