interface TaskSkeletonProps {
  count?: number;
}

export function TaskSkeleton({ count = 3 }: TaskSkeletonProps) {
  return (
    <div className="space-y-3" aria-label="Loading tasks">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="app-card app-shimmer p-4">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-lg bg-[var(--app-surface-3)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded-full bg-[var(--app-surface-3)]" />
              <div className="flex gap-2">
                <div className="h-7 w-20 rounded-full bg-[var(--app-surface-3)]" />
                <div className="h-7 w-16 rounded-full bg-[var(--app-surface-3)]" />
              </div>
            </div>
            <div className="h-9 w-9 rounded-full bg-[var(--app-surface-3)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
