import React from 'react';
import { t } from '../../i18n/translations';

interface AttributeChipProps {
  icon?: React.ReactNode;
  label: string;
  color?: string;
  muted?: boolean;
  active?: boolean;
  onClick?: () => void;
  onRemove?: (e: React.MouseEvent) => void;
}

/**
 * Single global pill chip for all task/grocery attributes.
 *
 * Compact (h-7), fully rounded, inline-flex.
 * Icon + text only — no avatars, no initials, no heavy styling.
 *
 * State variants:
 * - default: gray border, neutral bg
 * - colored (active=false + color set): tinted bg with color
 * - active=true: full color bg/border/text
 * - onClick: makes chip clickable (cursor-pointer, hover effects) — used for filter toggle
 * - onRemove: shows × button for attribute removal
 */
export const AttributeChip = ({ icon, label, color, muted, active, onClick, onRemove }: AttributeChipProps) => {
  const isActive = active ?? (!muted && !!color);
  const backgroundColor = color && isActive ? `${color}30` : undefined;
  const textColor = color && isActive ? color : undefined;
  const borderColor = color && isActive ? `${color}40` : '#e5e7eb';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-full text-xs font-normal leading-none border select-none ${
        onClick ? 'cursor-pointer hover:opacity-80 active:scale-95 transition-all' : ''
      }`}
      style={{ backgroundColor, color: textColor, borderColor }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {icon && <span className="flex-shrink-0 flex items-center">{icon}</span>}
      <span className="truncate max-w-[120px]">{label}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          className="ml-0.5 hover:opacity-70 leading-none text-current"
          aria-label={`${t('common.remove')} ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
};
