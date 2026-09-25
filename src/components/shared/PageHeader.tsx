import type React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, action }: PageHeaderProps) {
  return (
    <header className="app-page-header mx-auto w-full max-w-2xl px-[var(--app-space-screen-x)] pb-2 pt-5 app-animate-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--app-text-soft)]">
              {eyebrow}
            </p>
          )}
          <h1 className="truncate text-[30px] font-black leading-tight tracking-[-0.05em] text-[var(--app-text)]">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm font-semibold text-[var(--app-text-muted)]">{subtitle}</p>}
        </div>
        {action && <div className="flex min-h-[var(--app-touch-target)] flex-shrink-0 items-center">{action}</div>}
      </div>
    </header>
  );
}
