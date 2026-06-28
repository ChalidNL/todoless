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
  maxWidthClassName?: string;
  compact?: boolean;
  ariaLabel?: string;
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
export const AttributeChip = ({
  icon,
  label,
  color,
  muted,
  active,
  onClick,
  onRemove,
  maxWidthClassName = 'max-w-[120px]',
  compact = false,
  ariaLabel,
}: AttributeChipProps) => {
  const hasColor = !muted && !!color;
  const isSelected = !!active;
  const backgroundColor = hasColor ? `${color}${isSelected ? '26' : '18'}` : undefined;
  const textColor = hasColor ? color : undefined;
  const borderColor = hasColor ? `${color}${isSelected ? '80' : '4d'}` : '#e5e7eb';
  const boxShadow = hasColor && isSelected ? `0 0 0 1px ${color}33 inset` : undefined;

  return (
    <span
      className={`app-chip inline-flex items-center ${compact ? 'justify-center w-7 px-0' : 'gap-1.5 px-2'} h-7 rounded-full text-xs font-medium leading-none border select-none ${
        onClick ? 'cursor-pointer hover:opacity-80 active:scale-95 transition-all' : ''
      }`}
      style={{ backgroundColor, color: textColor, borderColor, boxShadow }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel || label}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {icon && <span className="flex-shrink-0 flex items-center">{icon}</span>}
      {!compact && <span className={`truncate ${maxWidthClassName}`}>{label}</span>}
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
