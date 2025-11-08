import React, { createContext, useContext, useEffect, useState } from 'react'

export type ViewMode = 'list' | 'tiles' | 'calendar' | 'kanban'

type Ctx = {
  mode: ViewMode
  setMode: (m: ViewMode) => void
}

const ViewModeContext = createContext<Ctx | null>(null)

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>(() => {
    const raw = localStorage.getItem('viewMode')
    return (raw === 'tiles' || raw === 'list' || raw === 'calendar' || raw === 'kanban') ? (raw as ViewMode) : 'list'
  })
  const setMode = (m: ViewMode) => {
    setModeState(m)
  }
  useEffect(() => {
    try { localStorage.setItem('viewMode', mode) } catch {}
  }, [mode])
  return <ViewModeContext.Provider value={{ mode, setMode }}>{children}</ViewModeContext.Provider>
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext)
  if (!ctx) throw new Error('useViewMode must be used within a ViewModeProvider')
  return ctx
}
