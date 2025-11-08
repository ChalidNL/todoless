import { create } from 'zustand'

type Status = 'disconnected' | 'connecting' | 'connected' | 'error'

interface RealtimeState {
  status: Status
  lastEventAt?: number
  lastError?: string
  errorCount: number
  setStatus: (status: Status, err?: string) => void
  markEvent: () => void
  reset: () => void
}

export const useRealtime = create<RealtimeState>((set) => ({
  status: 'disconnected',
  errorCount: 0,
  setStatus: (status, err) => set((s) => ({
    status,
    lastError: err || (status === 'error' ? s.lastError : undefined),
    errorCount: status === 'error' ? s.errorCount + 1 : s.errorCount,
  })),
  markEvent: () => set({ lastEventAt: Date.now() }),
  reset: () => set({ status: 'disconnected', lastEventAt: undefined, lastError: undefined, errorCount: 0 }),
}))
