import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface AppShellProps {
  children: ReactNode;
  bottomNav: ReactNode;
  toast?: ReactNode;
}

export function AppShell({ children, bottomNav, toast }: AppShellProps) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const scrollPositions = useRef<Record<string, number>>({});

  // Remember the scroll position of the route we are leaving.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const onScroll = () => {
      // Key by pathname only: sub-routes under /settings behave like separate
      // screens and should restore their own position.
      scrollPositions.current[location.pathname] = main.scrollTop;
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  // Restore the saved position when navigating back to a route; otherwise
  // start at the top (fresh screen expectation on mobile).
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const saved = scrollPositions.current[location.pathname] ?? 0;
    // Apply on the next frame so the route content has mounted.
    const raf = requestAnimationFrame(() => {
      main.scrollTop = saved;
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  return (
    <div className="app-shell-bg fixed inset-0 flex flex-col overflow-hidden">
      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-none pb-2">
        {children}
      </main>
      {toast}
      {bottomNav}
    </div>
  );
}
