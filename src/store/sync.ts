import { create } from 'zustand'

type Phase = 'idle' | 'running' | 'done'

interface SyncState {
  phase: Phase
  setPhase: (phase: Phase) => void
  // Convenience flags
  get ready(): boolean
}

export const useSync = create<SyncState>((set, get) => ({
  phase: 'idle',
  setPhase: (phase) => set({ phase }),
  get ready() {
    return get().phase === 'done'
  },
}))
