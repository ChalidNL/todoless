import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
// Lazy-load route pages to reduce main bundle size
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Settings = lazy(() => import('./pages/Settings'))
const CalendarPage = lazy(() => import('./pages/Calendar'))
const Planning = lazy(() => import('./pages/Planning'))
const Today = lazy(() => import('./pages/Today'))
const SavedFilter = lazy(() => import('./pages/SavedFilter'))
const ListView = lazy(() => import('./pages/ListView'))
const LabelsManagement = lazy(() => import('./pages/LabelsManagement'))
const WorkflowsManagement = lazy(() => import('./pages/WorkflowsManagement'))
const AttributesPage = lazy(() => import('./pages/Attributes'))
const NotesManagement = lazy(() => import('./pages/NotesManagement'))
const FiltersManagement = lazy(() => import('./pages/FiltersManagement'))
const AttributesManagement = lazy(() => import('./pages/AttributesMgmt'))
const Archive = lazy(() => import('./pages/Archive'))
const Logs = lazy(() => import('./pages/Logs'))
const Login = lazy(() => import('./pages/auth/Login'))
// Registration is disabled; use AcceptInvite
const AcceptInvite = lazy(() => import('./pages/auth/AcceptInvite'))
const TwoFA = lazy(() => import('./pages/auth/TwoFA'))
const ResetRequest = lazy(() => import('./pages/auth/ResetRequest'))
const ResetComplete = lazy(() => import('./pages/auth/ResetComplete'))
const BacklogServer = lazy(() => import('./pages/serverTasks/Backlog'))
const KanbanServer = lazy(() => import('./pages/serverTasks/Kanban'))
const BulkImport = lazy(() => import('./pages/BulkImport'))
const SecurityCenter = lazy(() => import('./pages/admin/Security'))
import Sidebar from './components/Sidebar'
import { FilterProvider } from './contexts/FilterContext'
import { SortProvider, useSort } from './contexts/SortContext'
import { useUserTheme } from './hooks/useUserTheme'
import SearchBar from './components/SearchBar'
import GlobalFilters from './components/GlobalFilters'
import ViewModeControl from './components/ViewModeControl'
import { useViewMode } from './contexts/ViewModeContext'
import FilterChips from './components/FilterChips'
import { Labels, Todos, Users, Workflows, ensureDefaults } from './db/dexieClient'
import { parseSmartSyntax } from './utils/smartSyntax'
import SortControl from './components/SortControl'
import CloseButton from './components/ui/CloseButton'
// DebugConsole removed; logs now live on /logs for admins only
import { useAuth } from './store/auth'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AdminRoute from './components/auth/AdminRoute'

export default function App() {
  const { color } = useUserTheme()
  const { user, me, logout } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState<string>(() => localStorage.getItem('globalQuery') || '')
  const [isDuplicate, setIsDuplicate] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { mode, setMode } = useViewMode()

  // Load session user on app start and ensure default data
  useEffect(() => {
    me().catch(() => {})
    ensureDefaults().catch(() => {})
  }, [])

  async function handleGlobalSubmit(q: string) {
    console.log('handleGlobalSubmit called with:', q)
    try {
      const [labels, users, workflows, allTodos] = await Promise.all([Labels.list(), Users.list(), Workflows.list(), Todos.list()])
      const parsed = parseSmartSyntax(q, labels)
      console.log('Parsed todo:', parsed)
      if (parsed.title.trim()) {
        console.log('Title is valid, checking for duplicates...')
        // Check for duplicate todo (case-insensitive)
        const existingTodo = allTodos.find((t) => t.title.toLowerCase() === parsed.title.toLowerCase())
        if (existingTodo) {
          console.log('Duplicate found! Not creating.')
          // Show duplicate warning
          setIsDuplicate(true)
          setTimeout(() => setIsDuplicate(false), 3000)
          return
        }
        console.log('No duplicate, proceeding to create...')
        setIsDuplicate(false)

        // Auto-inherit filter settings if on a filter page
        const { SavedFilters } = await import('./db/dexieClient')
        const currentPath = location.pathname
        const filterMatch = currentPath.match(/^\/filter\/(.+)/)
        let inheritedLabelIds: string[] = []
        let inheritedAssigneeIds: string[] = []

        if (filterMatch) {
          const filterId = filterMatch[1]
          const activeFilter = await SavedFilters.get(filterId)
          if (activeFilter && !activeFilter.isSystem) {
            // Inherit label filters
            if (activeFilter.labelFilterIds && activeFilter.labelFilterIds.length > 0) {
              inheritedLabelIds = [...activeFilter.labelFilterIds]
            }
            // Inherit assignee filters
            if (activeFilter.attributeFilters?.assignees) {
              inheritedAssigneeIds = activeFilter.attributeFilters.assignees.split(',').filter(Boolean)
            }
          }
        }

        const labelIds: string[] = [...parsed.labelIds, ...inheritedLabelIds]
        if (parsed.missingLabels && parsed.missingLabels.length) {
          for (const name of parsed.missingLabels) {
            // Check if label already exists (case-insensitive)
            const duplicate = labels.find((l) => l.name.toLowerCase() === name.toLowerCase())
            if (duplicate) {
              labelIds.push(duplicate.id)
            } else {
              const id = await Labels.add({ name, color: '#0ea5e9', shared: true })
              labelIds.push(id)
            }
          }
        }
        let assigneeIds: string[] | undefined
        if (parsed.assignees && parsed.assignees.length) {
          const mapped: string[] = []
          parsed.assignees.forEach((name) => {
            const u = users.find((x) => x.name?.toLowerCase() === name.toLowerCase())
            if (u) mapped.push(u.id)
          })
          if (mapped.length) assigneeIds = [...mapped, ...inheritedAssigneeIds]
        } else if (inheritedAssigneeIds.length > 0) {
          assigneeIds = inheritedAssigneeIds
        }
        let workflowId: string | undefined
        let workflowStage: string | undefined
        const linked = workflows.find((w) => w.labelIds && w.labelIds.some((id) => labelIds.includes(id)))
        if (linked) {
          workflowId = linked.id
          if (linked.stages && linked.stages.length > 0) workflowStage = linked.stages[0]
        }
        const attributes: Record<string, any> = { ...(parsed.attributes || {}) }
        if (parsed.dueDate) attributes.dueDate = parsed.dueDate
        console.log('About to add todo to database...')
        try {
          const newId = await Todos.add({
            title: parsed.title,
            completed: false,
            userId: 'local-user',
            labelIds,
            assigneeIds,
            workflowId,
            workflowStage,
            order: Date.now(),
            createdAt: new Date().toISOString(),
            dueDate: attributes.dueDate || undefined,
            attributes: Object.keys(attributes).length ? attributes : undefined,
          })
          console.log('Todo added successfully with id:', newId)
        } catch (addError) {
          console.log('ERROR adding todo:', addError)
          throw addError
        }
        setGlobalQuery('')
        localStorage.setItem('globalQuery', '')
        window.dispatchEvent(new CustomEvent('global-search', { detail: '' }))
        // Only navigate if not already on a task list page (Google Keep style: add and stay)
        if (!currentPath.startsWith('/filter/') && !currentPath.startsWith('/lists/') && currentPath !== '/') {
          navigate('/filter/all')
        }
        // todoBus already dispatches 'todo:added' event, so useFilteredTodos will update automatically
      } else {
        console.log('Title is empty after parsing, not creating todo')
      }
    } catch (e) {
      console.log('ERROR in handleGlobalSubmit:', JSON.stringify(e))
      console.log('ERROR message:', e instanceof Error ? e.message : String(e))
      console.log('ERROR stack:', e instanceof Error ? e.stack : 'no stack')
      console.error('Global submit failed', e)
    }
  }

  // Simple scroll restoration keyed by pathname
  useEffect(() => {
    const key = `scroll:${location.pathname}`
    const el = mainRef.current
    if (!el) return
    const top = sessionStorage.getItem(key)
    if (top) {
      el.scrollTop = parseInt(top, 10)
    }
    const handle = () => {
      sessionStorage.setItem(key, String(el.scrollTop))
    }
    el.addEventListener('scroll', handle)
    return () => {
      el.removeEventListener('scroll', handle)
    }
  }, [location.pathname])

  return (
    <SortProvider>
    <FilterProvider>
      <div
        className="flex h-full"
        style={{ ['--accent' as any]: color.replace('#', '').match(/.{1,2}/g)?.map((n: string) => parseInt(n, 16)).join(' ') }}
      >
        {/* Protect entire app shell unless on /auth/* */}
        {location.pathname.startsWith('/auth') ? (
          <main className="flex-1 overflow-y-auto flex flex-col">
            <div className="w-full p-4 pb-16 flex-1">
              <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
                <Routes>
                  <Route path="/auth/login" element={<Login />} />
                  <Route path="/auth/accept" element={<AcceptInvite />} />
                  <Route path="/auth/2fa" element={<TwoFA />} />
                  <Route path="/auth/reset" element={<ResetRequest />} />
                  <Route path="/auth/reset/complete" element={<ResetComplete />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        ) : (
  <ProtectedRoute>
  <>
        {/* Desktop sidebar (collapsible) */}
        <div className="hidden md:flex">
          <Sidebar />
        </div>
        <main ref={mainRef} className="flex-1 overflow-y-auto flex flex-col">
        <header className="sticky top-0 z-10 bg-white/70 backdrop-blur">
          <div className="flex w-full items-center gap-3 px-4 py-3">
            {/* Mobile hamburger only */}
            <button
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 md:hidden"
              title="Menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <span className="text-lg font-bold text-gray-700">»</span>
            </button>
            {/* Global search - always visible on mobile and desktop */}
            <div className="flex flex-1 items-center gap-2">
              <SearchBar
                variant="inline"
                query={globalQuery}
                onChange={(v) => {
                  setGlobalQuery(v)
                  setIsDuplicate(false) // Reset duplicate state when typing
                  localStorage.setItem('globalQuery', v)
                  window.dispatchEvent(new CustomEvent('global-search', { detail: v }))
                }}
                onSubmit={handleGlobalSubmit}
                placeholder="Add item: Buy milk #Groceries %store:aldi @john //tomorrow"
                isDuplicate={isDuplicate}
              />
              {/* View mode and sort controls - desktop only to save space */}
              <div className="hidden md:flex items-center gap-2">
                <ViewModeControl
                  value={mode}
                  onChange={(v) => {
                    setMode(v as any)
                    // Don't navigate - just change the visual mode
                    // Pages will render according to their current context + mode
                  }}
                />
                {/* Global Sorting next to view switcher */}
                <HeaderSortControl />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <GlobalFilters />
              <div className="relative">
                {user ? (
                  <>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                      onClick={() => setAvatarOpen((v) => !v)}
                      title="User menu"
                    >
                      {(user?.username?.[0] || 'U').toUpperCase()}
                    </button>
                    {avatarOpen && (
                      <div className="absolute right-0 top-10 z-20 w-40 rounded-md border border-gray-200 bg-white text-gray-900 shadow-card">
                        <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => { setAvatarOpen(false); navigate('/settings') }}>Settings</button>
                        <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => { setAvatarOpen(false); navigate('/auth/2fa') }}>Two-Factor</button>
                        {user?.role === 'adult' && (
                          <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => { setAvatarOpen(false); navigate('/admin/security') }}>Security Center</button>
                        )}
                        <button className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={async () => { setAvatarOpen(false); await logout(); navigate('/auth/login') }}>Log out</button>
                      </div>
                    )}
                  </>
                ) : (
                  <button className="px-3 py-1.5 rounded border hover:bg-gray-50 text-sm" onClick={() => navigate('/auth/login')}>
                    Login
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="w-full px-4 pb-2">
            <FilterChips />
          </div>
        </header>
        <div className="w-full p-4 pb-16 flex-1">
          <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/planning" element={<Planning />} />
              <Route path="/today" element={<Today />} />
              <Route path="/attributes" element={<AttributesPage />} />
              <Route path="/manage/filters" element={<FiltersManagement />} />
              <Route path="/manage/labels" element={<LabelsManagement />} />
              <Route path="/manage/workflows" element={<WorkflowsManagement />} />
              <Route path="/manage/attributes" element={<AttributesManagement />} />
              <Route path="/manage/notes" element={<NotesManagement />} />
              <Route path="/archive" element={<Archive />} />
              <Route path="/logs" element={<AdminRoute><Logs /></AdminRoute>} />
              <Route path="/bulk-import" element={<BulkImport />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/security" element={<SecurityCenter />} />
              {/* Auth + server-backed task routes */}
              <Route path="/backlog" element={<BacklogServer />} />
              <Route path="/kanban" element={<KanbanServer />} />
              <Route path="/filter/:filterId" element={<SavedFilter />} />
              <Route path="/lists/:listId" element={<ListView />} />
            </Routes>
          </Suspense>
        </div>

        </main>
        {/* Mobile drawer - responsive width based on sidebar state */}
        {mobileNavOpen && (
          <div className="md:hidden">
            <div
              className="fixed inset-0 z-40 bg-black/40"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="fixed left-0 top-0 z-50 h-full bg-white shadow-xl">
              <Sidebar className="border-r-0 h-full relative" />
            </div>
          </div>
        )}
  {/* DebugConsole removed */}
  </>
  </ProtectedRoute>
        )}
      </div>
    </FilterProvider>
    </SortProvider>
  )
}
// Inline header sort control bridged to SortContext
function HeaderSortControl() {
  const { value, setValue } = useSort()
  return <SortControl value={value as any} onChange={(v) => setValue(v as any)} />
}
