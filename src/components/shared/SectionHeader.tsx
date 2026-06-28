import type React from 'react';

interface SectionHeaderProps {
  title: string;
  count?: number;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'default' | 'focus' | 'blocked' | 'done';
}

const toneClass = {
  default: 'text-[var(--app-text)]',
  focus: 'text-orange-600',
  blocked: 'text-rose-600',
  done: 'text-violet-600',
};

export function SectionHeader({ title, count, icon, action, tone = 'default' }: SectionHeaderProps) {
  return (
    <div className="flex min-h-[var(--app-touch-target)] items-center justify-between gap-3 px-1">
      <div className={`flex min-w-0 items-center gap-2 ${toneClass[tone]}`}>
        {icon && <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-current/10">{icon}</span>}
        <h2 className="truncate text-sm font-black tracking-[-0.01em]">
          {title}{typeof count === 'number' ? ` (${count})` : ''}
        </h2>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
