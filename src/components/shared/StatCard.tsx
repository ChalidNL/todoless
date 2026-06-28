import type React from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: 'inbox' | 'todo' | 'blocked' | 'done' | 'focus';
  active?: boolean;
  onClick?: () => void;
}

const toneVar = {
  inbox: 'var(--app-status-inbox)',
  todo: 'var(--app-status-todo)',
  blocked: 'var(--app-status-blocked)',
  done: 'var(--app-status-done)',
  focus: 'var(--app-status-focus)',
};

export function StatCard({ label, value, icon, tone = 'inbox', active, onClick }: StatCardProps) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      className={`app-status-card relative isolate min-h-[104px] w-full overflow-hidden text-left text-white transition active:scale-[0.97] ${active ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--app-bg)]' : ''}`}
      style={{ background: toneVar[tone] }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/35" />
      <div className="relative z-10 flex h-full items-center gap-3">
        <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/25 backdrop-blur-sm">
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold leading-none text-white/90">{label}</span>
        <p className="flex-shrink-0 text-[32px] font-black leading-none tracking-[-0.05em] text-white drop-shadow-sm">{value}</p>
      </div>
    </Component>
  );
}
