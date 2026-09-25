import type React from 'react';
import { NavLink } from 'react-router-dom';

export interface BottomNavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  activeColor?: string;
  activeBg?: string;
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
            className="flex min-h-[var(--app-touch-target)] flex-1 select-none flex-col items-center justify-center gap-[2px] rounded-2xl px-1 py-1 text-center transition-all active:scale-[0.97]"
          >
            {({ isActive }) => {
              const activeColor = item.activeColor || 'var(--app-primary)';
              const inactiveColor = '#94a3b8';
              return (
                <>
                  <div
                    className="relative flex items-center justify-center rounded-full px-3.5 py-1.5 transition-colors"
                    style={{ background: isActive ? item.activeBg : 'transparent', color: isActive ? activeColor : inactiveColor }}
                  >
                    {item.icon}
                  </div>
                  <span className="block w-full truncate whitespace-nowrap text-center text-[10px] leading-none" style={{ color: isActive ? activeColor : inactiveColor, fontWeight: isActive ? 700 : 500 }}>
                    {item.label}
                  </span>
                  <span className="mt-px h-1 w-1 rounded-full" style={{ background: isActive ? activeColor : 'transparent' }} />
                </>
              );
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
