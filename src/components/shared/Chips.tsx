import type React from 'react';
import { AlertTriangle, CalendarDays, Hash, MessageCircle, Repeat2, ShoppingCart, Tag, UserRound } from 'lucide-react';

export interface ChipProps {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  active?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

export function Chip({ label, icon, color, active, onClick, title, className = '' }: ChipProps) {
  const Component = onClick ? 'button' : 'span';
  const style = color
    ? active
      ? { backgroundColor: color, color: 'var(--color-primary-foreground)' }
      : { backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }
    : undefined;

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title || label}
      aria-label={label}
      className={`app-chip inline-flex min-h-7 max-w-full select-none items-center gap-1.5 rounded-full px-2.5 text-xs font-bold leading-none ring-1 ring-black/[0.04] transition active:scale-[0.97] ${onClick ? 'cursor-pointer hover:opacity-90' : ''} ${active && !color ? 'bg-[var(--app-primary)] text-white' : !color ? 'bg-[var(--app-surface-2)] text-[var(--app-text-muted)]' : ''} ${className}`}
      style={style}
    >
      {icon && <span className="flex flex-shrink-0 items-center">{icon}</span>}
      <span className="truncate">{label}</span>
    </Component>
  );
}

export const LabelChip = (props: Omit<ChipProps, 'icon'>) => <Chip icon={<Tag className="h-3.5 w-3.5" />} {...props} />;
export const DueDateChip = (props: Omit<ChipProps, 'icon' | 'color'>) => <Chip icon={<CalendarDays className="h-3.5 w-3.5" />} color="#f97316" {...props} />;
export const PriorityChip = (props: Omit<ChipProps, 'icon'>) => <Chip icon={<AlertTriangle className="h-3.5 w-3.5" />} {...props} />;
export const SubtaskChip = (props: Omit<ChipProps, 'icon' | 'color'>) => <Chip icon={<Hash className="h-3.5 w-3.5" />} color="var(--app-primary)" {...props} />;
export const AssigneeChip = (props: Omit<ChipProps, 'icon'>) => <Chip icon={<UserRound className="h-3.5 w-3.5" />} {...props} />;
export const ReactionChip = (props: Omit<ChipProps, 'icon' | 'color'>) => <Chip icon={<MessageCircle className="h-3.5 w-3.5" />} color="var(--app-primary)" {...props} />;
export const StoreChip = (props: Omit<ChipProps, 'icon'>) => <Chip icon={<ShoppingCart className="h-3.5 w-3.5" />} {...props} />;
export const RepeatChip = (props: Omit<ChipProps, 'icon' | 'color'>) => <Chip icon={<Repeat2 className="h-3.5 w-3.5" />} color="#0f766e" {...props} />;
