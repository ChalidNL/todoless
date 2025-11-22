import { create } from 'zustand'

type Phase = 'idle' | 'running' | 'done'

interface ConflictInfo {
  todoId: string
  localVersion: any
  serverVersion: any
  timestamp: number
}

interface SyncState {
  phase: Phase
  lastSyncAt?: number
  pendingCount: number
  conflicts: ConflictInfo[]
  setPhase: (phase: Phase) => void
  setLastSyncAt: (timestamp: number) => void
  setPendingCount: (count: number) => void
  addConflict: (conflict: ConflictInfo) => void
  clearConflicts: () => void
  // Convenience flags
  get ready(): boolean
  get hasConflicts(): boolean
}

export const useSync = create<SyncState>((set, get) => ({
  phase: 'idle',
  pendingCount: 0,
  conflicts: [],
  setPhase: (phase) => set({ phase }),
  setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),
  setPendingCount: (count) => set({ pendingCount: count }),
  addConflict: (conflict) => set((s) => ({ conflicts: [...s.conflicts, conflict] })),
  clearConflicts: () => set({ conflicts: [] }),
  get ready() {
    return get().phase === 'done'
  },
  get hasConflicts() {
    return get().conflicts.length > 0
  },
}))
