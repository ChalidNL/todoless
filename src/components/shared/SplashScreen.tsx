import { AppMark } from './AppLogo';

export function SplashScreen() {
  return (
    <div className="app-splash app-rainbow-animated min-h-screen bg-[var(--app-bg)] flex items-center justify-center px-6">
      <div className="app-scale-in relative flex flex-col items-center gap-4">
        <div className="absolute inset-[-48px] -z-10 rounded-full bg-[var(--app-rainbow-soft)] blur-3xl" />
        <div className="grid h-24 w-24 place-items-center rounded-[32px] bg-white/75 shadow-[var(--app-shadow-card-active)] ring-1 ring-white/60 backdrop-blur-xl">
          <AppMark className="h-16 w-16 animate-pulse" />
        </div>
        <div className="text-center">
          <p className="text-xl font-black tracking-[-0.04em] text-[var(--app-text)]">todoless</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.24em] text-[var(--app-text-muted)]">loading</p>
        </div>
      </div>
    </div>
  );
}
