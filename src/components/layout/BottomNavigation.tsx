import type React from 'react';
import { NavLink } from 'react-router-dom';

export interface BottomNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

interface BottomNavigationProps {
  items: BottomNavItem[];
}

export function BottomNavigation({ items }: BottomNavigationProps) {
  return (
    <nav
      aria-label="Primary"
      className="app-bottom-nav mx-auto w-full max-w-xl flex-shrink-0 z-40"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)' }}
    >
      <div className="mx-auto flex items-center justify-around gap-1 px-2 pt-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-h-[var(--app-touch-target)] flex-1 select-none flex-col items-center justify-center gap-0 rounded-2xl px-2 py-1.5 text-center transition-all active:scale-[0.97] ${
                isActive
                  ? 'app-nav-active'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-primary)]'
              }`
            }
          >
            <div className="relative flex h-6 items-center justify-center">
              {item.icon}
            </div>
            <span className="block w-full truncate whitespace-nowrap text-center text-[9px] font-bold leading-tight sm:text-[10px]">
              {item.label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
