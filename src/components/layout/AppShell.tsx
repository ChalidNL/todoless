import type React from 'react';

interface AppShellProps {
  children: React.ReactNode;
  bottomNav: React.ReactNode;
  toast?: React.ReactNode;
}

export function AppShell({ children, bottomNav, toast }: AppShellProps) {
  return (
    <div className="app-shell-bg fixed inset-0 flex flex-col overflow-hidden">
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-none pb-2">
        {children}
      </main>
      {toast}
      {bottomNav}
    </div>
  );
}
