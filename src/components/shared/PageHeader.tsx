import type React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="app-page-header max-w-2xl mx-auto px-4 pt-5 pb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.04em] text-[var(--app-text)]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm font-medium text-[var(--app-text-muted)]">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
