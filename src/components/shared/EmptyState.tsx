import type React from 'react';
import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="app-surface app-scale-in relative overflow-hidden px-6 py-12 text-center">
      <div className="pointer-events-none absolute left-1/2 top-8 h-28 w-28 -translate-x-1/2 rounded-full bg-[var(--app-rainbow-soft)] blur-2xl" />
      <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-[24px] bg-white/80 text-[var(--app-primary)] shadow-[var(--app-shadow-card)] ring-1 ring-white/70">
        {icon || <Sparkles className="h-7 w-7" strokeWidth={2.2} />}
      </div>
      <h2 className="relative text-base font-black tracking-[-0.02em] text-[var(--app-text)]">{title}</h2>
      {description && <p className="relative mx-auto mt-2 max-w-[260px] text-sm font-semibold text-[var(--app-text-muted)]">{description}</p>}
      {action && <div className="relative mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
