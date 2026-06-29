import type React from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: 'inbox' | 'todo' | 'blocked' | 'done' | 'focus';
  active?: boolean;
  onClick?: () => void;
  testId?: string;
  status?: string;
}

const toneVar = {
  inbox: 'var(--app-status-inbox)',
  todo: 'var(--app-status-todo)',
  blocked: 'var(--app-status-blocked)',
  done: 'var(--app-status-done)',
  focus: 'var(--app-status-focus)',
};

export function StatCard({ label, value, icon, tone = 'inbox', active, onClick, testId, status }: StatCardProps) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-testid={testId}
      data-status={status}
      aria-label={`${label}: ${value}`}
      className={`app-status-card relative isolate min-h-[82px] w-full overflow-hidden rounded-[var(--app-radius-card)] p-[14px] text-left text-white shadow-[var(--app-shadow-card)] transition active:scale-[0.97] ${active ? 'scale-[1.02] ring-2 ring-white/70 ring-offset-2 ring-offset-[var(--app-bg)]' : ''}`}
      style={{ background: toneVar[tone] }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/35" />
      <div className="relative z-10 flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--app-radius-md)] bg-white/22 ring-1 ring-white/25 backdrop-blur-sm">
            {icon}
          </span>
          <p className="flex-shrink-0 text-2xl font-black leading-none tracking-[-0.05em] text-white drop-shadow-sm">{value}</p>
        </div>
        <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.04em] text-white/90">{label}</span>
      </div>
    </Component>
  );
}
