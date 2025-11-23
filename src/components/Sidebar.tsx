
import clsx from 'clsx';
import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../store/auth';
import { SavedFilters } from '../db/dexieClient';
import type { SavedFilter } from '../db/schema';
import SaveFilterButton from './SaveFilterButton';
import { VERSION, isTestOrDevEnvironment } from '../config/version';

export default function Sidebar({ className }: { className?: string }) {
  const navigate = useNavigate()
  const asideRef = useRef<HTMLElement | null>(null)
  const [saved, setSaved] = useState<SavedFilter[]>([])
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('sidebar:collapsed')
      if (stored !== null) return stored === 'true'
    } catch {}
    if (typeof window !== 'undefined' && window.innerWidth < 768) return true
    return false
  })

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem('sidebar:collapsed', String(next))
      } catch {}
      return next
    })
  }

  const loadSaved = async () => {
    try {
      // HOTFIX 0.0.55: Pass authenticated user ID
      await SavedFilters.ensureMeFilter(user?.id)
      await SavedFilters.ensureDefaultFilters()
      const list = await SavedFilters.list()
      // Sort by name asc
      list.sort((a, b) => a.name.localeCompare(b.name))
      setSaved(list)
    } catch {}
  }

  useEffect(() => {
    loadSaved()
    const handler = () => loadSaved()
    window.addEventListener('saved-filters:refresh', handler)
    return () => window.removeEventListener('saved-filters:refresh', handler)
  }, [user?.id])

  // Simple swipe gestures: swipe right from left edge to expand, swipe left on sidebar to collapse
  useEffect(() => {
    let startX = 0
    let startY = 0
    let edgeStart = false
    let startedInSidebar = false

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      edgeStart = startX <= 16 // left edge
      startedInSidebar = !!asideRef.current && asideRef.current.contains(e.target as Node)
    }
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      // horizontal intent threshold
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
      if (edgeStart && dx > 40) {
        setCollapsed(false)
      } else if (startedInSidebar && dx < -40) {
        setCollapsed(true)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  // Remove hardcoded "All" view - it's now in the database

  // Start collapsed on mobile by default, but allow user to expand
  // Use localStorage if available, else default to collapsed on small screens
  // (No separate isMobileCollapsed flag so user can expand on mobile.)

  return (
  <aside ref={asideRef as any} className={clsx('group/sidebar sticky top-0 h-screen shrink-0 flex flex-col border-r bg-white transition-[width] duration-300 ease-in-out', collapsed ? 'w-[56px]' : 'w-72', className)}>
      {/* Header - hide on mobile in drawer, show on desktop */}
      <div className={clsx('items-center border-b p-3', collapsed ? 'justify-center hidden md:flex' : 'justify-between hidden md:flex')}>
        {!collapsed && (
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-accent/10 text-accent font-bold text-sm">T</div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">Todoless</span>
                <div className="flex items-center gap-1.5">
                      {isTestOrDevEnvironment() && (
                        <span className="text-[10px] font-bold text-red-600 tracking-wide mr-1">TST</span>
                      )}
                      <span className="text-[10px] text-gray-500 font-bold">v{VERSION}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      <button
          className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100"
          onClick={toggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="text-lg font-bold text-gray-700">
            {collapsed ? '»' : '«'}
          </span>
        </button>
      </div>
      {/* Mobile header with expand/collapse button */}
      <div className="md:hidden p-2">
        <button
          className="flex h-9 w-full items-center justify-center gap-2 rounded hover:bg-gray-100 transition-all text-gray-700 font-medium"
          onClick={toggleCollapse}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {!collapsed && (
            <>
              <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 text-accent font-bold text-xs">T</div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold">Todoless</span>
                <div className="flex items-center gap-1.5">
                      {isTestOrDevEnvironment() && (
                        <span className="text-[10px] font-bold text-red-600 tracking-wide mr-1">TST</span>
                      )}
                      <span className="text-[10px] text-gray-500 font-bold">v{VERSION}</span>
                </div>
              </div>
            </>
          )}
          <span className="text-lg font-bold text-gray-700">
            {collapsed ? '»' : '«'}
          </span>
        </button>
      </div>
      <nav className={clsx('flex-1 space-y-4 overflow-y-hidden hover:overflow-y-auto p-2 md:p-3', collapsed && 'overflow-y-hidden')}>
        {/* Dashboard at top */}
        <div>
          <ul className="space-y-1">
            <li>
              <NavLink
                className={(s: { isActive: boolean }) =>
                  `sidebar-link ${collapsed ? 'justify-center' : 'justify-start'} ${s.isActive ? 'text-accent' : ''}`
                }
                to="/dashboard"
                title={collapsed ? 'Dashboard' : ''}
              >
                <span className="icon-container">
                  <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
                  </svg>
                </span>
                {!collapsed && <span className="ml-2">Dashboard</span>}
              </NavLink>
            </li>
          </ul>
        </div>
        {/* Saved Filters */}
        <div>
          {!collapsed && (
            <div className="sidebar-section-title mb-2 px-2">
              <span>SAVED FILTERS</span>
            </div>
          )}
          <ul className="space-y-1">
            {/* All saved filters (including default ones) */}
            {saved.filter((f) => f.showInSidebar !== false).map((f) => (
                <li key={f.id} className="group flex items-center">
                  <NavLink
                    className={(s: { isActive: boolean }) => `flex-1 sidebar-link ${collapsed ? 'justify-center' : 'justify-start'} ${s.isActive ? 'text-accent' : ''}`}
                    to={`/filter/${f.id}`}
                    title={collapsed ? f.name : ''}
                  >
                    <span className="icon-container">
                      {f.isDefault ? (
                        <span className="sidebar-icon-emoji">⭐</span>
                      ) : f.icon ? (
                        <span className="color-icon">{f.icon}</span>
                      ) : (
                        <svg className="icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                      )}
                    </span>
                    {!collapsed && <span className="ml-2">{f.name}</span>}
                  </NavLink>
                  {!collapsed && !f.isDefault && !f.isSystem && (
                    <div className="mr-1 hidden gap-1 group-hover:flex">
                      <button
                        className="w-6 h-6 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-gray-100"
                        title="Rename"
                        onClick={async (e) => {
                          e.preventDefault(); e.stopPropagation()
                          const next = window.prompt('Rename filter', f.name)?.trim()
                          if (!next || next === f.name) return
                          // Check for duplicate
                          const all = await SavedFilters.list()
                          const duplicate = all.find((x) => x.id !== f.id && x.name.toLowerCase() === next.toLowerCase())
                          if (duplicate) {
                            alert(`Filter "${next}" already exists`)
                            return
                          }
                          if (next.toLowerCase() === 'all') {
                            alert('"All" is a reserved system filter name')
                            return
                          }
                          await SavedFilters.update(f.id, { name: next })
                          loadSaved()
                        }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {!f.isSystem && !f.isDefault && (
                        <button
                        className="w-6 h-6 flex items-center justify-center rounded border-2 border-gray-300 hover:bg-red-50 text-red-600"
                        title="Delete"
                        onClick={async (e) => {
                          e.preventDefault(); e.stopPropagation()
                          if (!confirm('Delete this filter?')) return
                          await SavedFilters.remove(f.id)
                          loadSaved()
                        }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </div>

        {/* MANAGEMENT */}
        <div>
          {!collapsed && <div className="sidebar-section-title mb-2 px-2">MANAGEMENT</div>}
          <ul className="space-y-1">
            {[
              {
                to: '/manage/filters',
                name: 'Filters',
                icon: <svg className="inline-block icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              },
              { 
                to: '/manage/notes', 
                name: 'Notes', 
                icon: <svg className="inline-block icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              },
              { 
                to: '/manage/labels', 
                name: 'Labels', 
                icon: <svg className="inline-block icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              },
              { 
                to: '/manage/workflows', 
                name: 'Workflows', 
                icon: <svg className="inline-block icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              },
              { 
                to: '/manage/attributes', 
                name: 'Attributen', 
                icon: <svg className="inline-block icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              },
              { 
                to: '/archive', 
                name: 'Archive', 
                icon: <svg className="inline-block icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
                </svg>
              },
              { 
                to: '/bulk-import', 
                name: 'Bulk Import', 
                icon: <svg className="inline-block icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              },
              user?.role === 'adult' ? {
                to: '/logs',
                name: 'Logs',
                icon: <svg className="inline-block icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              } : null,
              { 
                to: '/settings', 
                name: 'Settings', 
                icon: <svg className="inline-block icon-standard" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              },
            ].filter(Boolean).map((link) => (
              <li key={(link as any).to}>
                <NavLink
                  className={(s: { isActive: boolean }) => `sidebar-link ${collapsed ? 'justify-center' : 'justify-start'} ${s.isActive ? 'text-accent' : ''}`}
                  to={(link as any).to}
                  title={collapsed ? (link as any).name : ''}
                >
                  {(link as any).icon}
                  {!collapsed && <span className="ml-2">{(link as any).name}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      {/* Bottom toggle removed: we keep a single responsive control at the top */}
    </aside>
  )
}

