import { create } from 'zustand'

type Status = 'disconnected' | 'connecting' | 'connected' | 'error'

interface RealtimeState {
  status: Status
  lastEventAt?: number
  lastError?: string
  errorCount: number
  reconnectAttempt: number
  nextReconnectAt?: number
  setStatus: (status: Status, err?: string) => void
  markEvent: () => void
  incrementReconnect: () => void
  setNextReconnectAt: (timestamp: number) => void
  reset: () => void
}

export const useRealtime = create<RealtimeState>((set) => ({
  status: 'disconnected',
  errorCount: 0,
  reconnectAttempt: 0,
  setStatus: (status, err) => set((s) => ({
    status,
    lastError: err || (status === 'error' ? s.lastError : undefined),
    errorCount: status === 'error' ? s.errorCount + 1 : s.errorCount,
    reconnectAttempt: status === 'connected' ? 0 : s.reconnectAttempt,
  })),
  markEvent: () => set({ lastEventAt: Date.now() }),
  incrementReconnect: () => set((s) => ({ reconnectAttempt: s.reconnectAttempt + 1 })),
  setNextReconnectAt: (timestamp) => set({ nextReconnectAt: timestamp }),
  reset: () => set({
    status: 'disconnected',
    lastEventAt: undefined,
    lastError: undefined,
    errorCount: 0,
    reconnectAttempt: 0,
    nextReconnectAt: undefined,
  }),
}))
