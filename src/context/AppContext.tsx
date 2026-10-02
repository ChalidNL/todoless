import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getISOWeek } from '../utils/dateUtils';
import { api, isInvalidOldPasswordError, normalizeItem, normalizeLabel, normalizeTask } from '../lib/pocketbase-client';
import { applyRealtimeEvent, isVisibleToMe } from '../lib/realtime-reducer';
import { t } from '../i18n/translations';
import { classifyLoadError } from '../lib/load-error';
import { pb } from '../lib/pocketbase';

const FILTER_PARAM_KEY = 'filters';

interface ChipFilter { type: string; id: string; label?: string; color?: string; }

// Read chip filters from URL search params
function readFiltersFromUrl(): ChipFilter[] {
  const params = new URLSearchParams(window.location.search);
  const filtersParam = params.get(FILTER_PARAM_KEY);
  if (!filtersParam) return [];

  const chipFilters: ChipFilter[] = [];

  for (const part of filtersParam.split(',')) {
    const [type, ...idParts] = part.split(':');
    const id = idParts.join(':');
    if (!type || !id) continue;
    chipFilters.push({ type, id });
  }

  return chipFilters;
}

// Write chip filters to URL search params
function writeFiltersToUrl(chipFilters: ChipFilter[]) {
  const parts: string[] = [];
  for (const f of chipFilters) parts.push(`${f.type}:${f.id}`);
  const url = new URL(window.location.href);
  if (parts.length > 0) {
    url.searchParams.set(FILTER_PARAM_KEY, parts.join(','));
  } else {
    url.searchParams.delete(FILTER_PARAM_KEY);
  }
  window.history.replaceState({}, '', url.toString());
}
import type {
  Item,
  Task,
  Note,
  Label,
  Shop,
  AppSettings,
  ProgressStats,
  Sprint,
  User,
  SprintDuration,
  InviteCode,
  Reward,
  Goal,
  Project,
  Reminder,
  Entry,
} from '../types';

// Helper to convert Entry to Item
const entryToItem = (entry: Entry): Item => ({
  id: entry.id,
  title: entry.title,
  completed: entry.completed ?? false,
  focus: entry.focus ?? false,
  shopId: entry.shopId,
  quantity: entry.quantity,
  priority: entry.priority,
  assignedTo: entry.assignedTo,
  dueDate: entry.dueDate,
  labels: entry.labels,
  linkedTaskIds: entry.linkedItemIds,
  linkedNoteIds: entry.linkedNoteIds,
  createdAt: entry.createdAt,
  createdBy: entry.createdBy,
  isPrivate: entry.isPrivate,
  category: entry.category,
  location: entry.location,
});

// Helper to convert Entry to Task
const entryToTask = (entry: Entry): Task => ({
  id: entry.id,
  title: entry.title,
  status: entry.status ?? 'todo',
  blocked: entry.blocked ?? false,
  blockedComment: entry.blockedComment,
  priority: entry.priority,
  horizon: entry.horizon,
  assignedTo: entry.assignedTo,
  sprintId: entry.sprintId,
  dueDate: entry.dueDate,
  repeatInterval: entry.repeatInterval,
  completedAt: entry.completedAt,
  archived: entry.archived ?? false,
  archivedAt: entry.archivedAt,
  deleteAfter: entry.deleteAfter,
  isPrivate: entry.isPrivate ?? false,
  labels: entry.labels,
  labelId: entry.labelId,
  linkedItemIds: entry.linkedItemIds,
  linkedNoteIds: entry.linkedNoteIds,
  subtaskIds: entry.subtaskIds,
  focus: entry.focus ?? false,
  linkedTo: entry.linkedTo,
  linkedType: entry.linkedType,
  flag: entry.flag ?? false,
  startTime: entry.startTime,
  endTime: entry.endTime,
  allDay: entry.allDay,
  showInCalendar: entry.showInCalendar,
  // iCalendar fields
  description: entry.description,
  location: entry.location,
  uid: entry.uid,
  timezone: entry.timezone,
  rrule: entry.rrule,
  exdates: entry.exdates,
  recurrenceId: entry.recurrenceId,
  source: entry.source,
  externalId: entry.externalId,
  createdAt: entry.createdAt,
  createdBy: entry.createdBy,
});

interface AppContextType {
  dataLoadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  retryLoad: () => Promise<void>;
  items: Item[];
  tasks: Task[];
  notes: Note[];
  labels: Label[];
  shops: Shop[];
  sprints: Sprint[];
  users: User[];
  inviteCodes: InviteCode[];
  rewards: Reward[];
  goals: Goal[];
  projects: Project[];
  sharedView: boolean;
  appSettings: AppSettings;
  progressStats: ProgressStats;
  completionMessage: string | null;
  currentSprint: Sprint | null;
  // Entry model
  entries: Entry[];
  addEntry: (entry: Omit<Entry, 'id' | 'createdAt'>) => void;
  updateEntry: (id: string, updates: Partial<Entry>) => void;
  deleteEntry: (id: string) => void;
  completeEntry: (id: string) => void;
  assignEntry: (id: string, userId: string) => void;
  refreshEntries: () => Promise<void>;
  // Legacy methods
  addItem: (item: Omit<Item, 'id' | 'createdAt'>) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => void;
  addNote: (note: Omit<Note, 'id' | 'createdAt'>) => void;
  addLabel: (label: Omit<Label, 'id'>) => Promise<Label | undefined>;
  createLabel: (label: Omit<Label, 'id'>) => Promise<Label | undefined>;
  addShop: (shop: Omit<Shop, 'id'>) => void;
  createShop: (shop: Omit<Shop, 'id'>) => void;
  addSprint: (sprint: Omit<Sprint, 'id'>) => void;
  addUser: (user: User) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  updateLabel: (id: string, updates: Partial<Label>) => void;
  updateShop: (id: string, updates: Partial<Shop>) => void;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  updateUser: (id: string, updates: Partial<User>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  deleteItem: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteTasks: (ids: string[]) => void;
  deleteNote: (id: string) => void;
  deleteLabel: (id: string) => void;
  deleteShop: (id: string) => void;
  deleteSprint: (id: string) => void;
  updateSprint: (id: string, updates: Partial<Sprint>) => void;
  startSprint: (id: string) => void;
  completeSprint: (id: string) => void;
  archiveCompletedSprintTasks: (sprintId?: string) => void;
  archiveAllDoneTasks: () => void;
  deleteArchivedTasks: () => void;
  cleanupExpiredArchives: () => void;
  activeChipFilters: {type: string; id: string; label?: string; color?: string}[];
  toggleChipFilter: (type: string, id: string, label?: string, color?: string) => void;
  clearChipFilters: () => void;
  isChipFilterActive: (type: string, id: string) => boolean;
  showCompletionMessage: (message: string) => void;
  moveTaskToStatus: (taskId: string, status: 'backlog' | 'todo' | 'done') => void;
  createNewSprint: () => void;
  convertTaskToItem: (taskId: string) => void;
  convertItemToTask: (itemId: string) => void;
  swapEntity: (id: string) => void;
  generateInviteCode: (type?: 'human' | 'agent') => Promise<InviteCode | null>;
  deleteInviteCode: (id: string) => void;
  uncheckAllDoneTasks: () => void;
  uncheckAllDoneItems: () => void;
  addReward: (reward: Omit<Reward, 'id'>) => void;
  deleteReward: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  setSharedView: (shared: boolean) => void;
  refreshRewards: () => Promise<void>;
  refreshGoals: () => Promise<void>;
  totalPoints: number;
  updateReward: (id: string, updates: Partial<Reward>) => void;
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  refreshProjects: () => Promise<void>;
  reminders: Reminder[];
  addReminder: (reminder: Omit<Reminder, 'id' | 'createdAt' | 'dismissed' | 'fired'>) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  dismissReminder: (id: string) => void;
  deleteReminder: (id: string) => void;
  refreshReminders: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  return new Date(now.setDate(diff)).setHours(0, 0, 0, 0);
};

const defaultSettings: AppSettings = {
  hasCompletedOnboarding: false,
  sprintDuration: '2weeks',
  sprintStartDay: 1,
  currentUserId: undefined,
  language: 'en',
  archiveRetention: 30,
  autoCleanup: true,
  theme: 'light',
  notificationEmail: false,
  notificationPush: false,
  taskReminders: true,
  reminderMinutes: 15,
};

// Single source of truth for the task/item -> unified entries mapping.
// Used by BOTH the legacy refreshEntries() path and the GH#75 bootstrap path
// so the two can never diverge.
const buildEntries = (fetchedTasks: Task[], fetchedItems: Item[]): Entry[] => {
  const taskEntries: Entry[] = fetchedTasks.map(t => ({
    ...t,
    type: 'task' as const,
    completed: t.status === 'done',
  }));
  const itemEntries: Entry[] = fetchedItems.map(i => ({
    ...i,
    type: 'item' as const,
    status: i.completed ? 'done' as const : 'todo' as const,
    blocked: false,
    flag: false,
    focus: i.focus ?? false,
    completed: i.completed,
  }));
  return [...taskEntries, ...itemEntries];
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [sharedView, setSharedView] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
  const [progressStats] = useState<ProgressStats>({
    tasksCompletedThisWeek: 0,
    lastWeekReset: getWeekStart(),
  });
  const [activeChipFilters, setActiveChipFilters] = useState<ChipFilter[]>(() => readFiltersFromUrl());
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [dataLoadState, setDataLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Shared-view bookkeeping. The auto-switch to shared view (users.length > 1)
  // must be known synchronously when tasks/items are fetched, otherwise boot
  // starts a second round-trip that races the initial load (GH#76).
  const sharedViewRef = useRef(false);
  // Scope of the tasks/items currently (or about to be) stored in state, so the
  // shared-view effect can skip redundant refetches when data already matches.
  const entriesScopeRef = useRef<'all' | 'shared' | null>(null);
  // Monotonic fetch sequence: the last *initiated* refresh wins, so a slow
  // response can never overwrite a newer, correctly-scoped one.
  const entriesFetchSeqRef = useRef(0);

  // Entry model state
  const [entries, setEntries] = useState<Entry[]>([]);

  // Derive tasks/items from entries via useMemo
  const derivedTasks = useMemo(() => entries.filter(e => e.type === 'task').map(entryToTask), [entries]);
  const derivedItems = useMemo(() => entries.filter(e => e.type === 'item').map(entryToItem), [entries]);

  // Use derived or direct state - prefer entries data when available, fallback to legacy state
  const effectiveTasks = derivedTasks.length > 0 ? derivedTasks : tasks;
  const effectiveItems = derivedItems.length > 0 ? derivedItems : items;

  const refreshNotes = async () => setNotes(await api.getNotes());
  const refreshItems = async () => setItems(await api.getItems());
  const refreshTasks = async () => setTasks(await api.getTasks());
  const refreshLabels = async () => setLabels(await api.getLabels());
  const refreshShops = async () => setShops(await api.getShops());
  const refreshSprints = async () => setSprints(await api.getSprints());
  const refreshUsers = async () => setUsers(await api.getUsers());
  const refreshInvites = async () => setInviteCodes(await api.getInvites());
  const refreshRewards = async () => setRewards(await api.getRewards());
  const refreshGoals = async () => setGoals(await api.getGoals());
  const refreshProjects = async () => setProjects(await api.getProjects());
  const refreshReminders = async () => setReminders(await api.getReminders());

  // Entry model refresh - combines tasks + items into unified list.
  // Scope-aware: in shared view (family with multiple members) only non-private
  // tasks/items are shown, otherwise the full family list. The scope is resolved
  // from sharedViewRef synchronously so callers never depend on React state
  // timing (GH#76). A monotonic sequence makes the last *initiated* fetch win,
  // so a slow response can never overwrite a newer, correctly-scoped one.
  const refreshEntries = async (scope?: 'all' | 'shared') => {
    const effectiveScope = scope ?? (sharedViewRef.current ? 'shared' : 'all');
    const seq = ++entriesFetchSeqRef.current;
    entriesScopeRef.current = effectiveScope;
    const fetchTasks = effectiveScope === 'shared' ? api.getSharedTasks : api.getTasks;
    const fetchItems = effectiveScope === 'shared' ? api.getSharedItems : api.getItems;
    const [fetchedTasks, fetchedItems] = await Promise.all([
      fetchTasks(),
      fetchItems(),
    ]);
    if (seq !== entriesFetchSeqRef.current) return;
    setTasks(fetchedTasks);
    setItems(fetchedItems);
    setEntries(buildEntries(fetchedTasks, fetchedItems));
  };

  // Persists a new entry and resolves once the server has it (no refresh).
  const persistNewEntry = async (entry: Omit<Entry, 'id' | 'createdAt'>) => {
    if (entry.type === 'task') {
      const { completed, ...taskData } = entry;
      await api.createTask({ ...taskData, status: completed ? 'done' : 'todo' });
    } else {
      const { blocked, blockedComment, flag, ...itemData } = entry;
      await api.createItem(itemData);
    }
  };

  // Bulk mutations: run the per-record requests with bounded concurrency and
  // refresh ONCE at the end. Firing N updates each followed by a full
  // refreshEntries() meant 3N requests in one burst (the nginx api_general
  // zone allows 120) and N racing refetches. Failures are logged and reported
  // once; the final refresh brings the UI back in line with the server.
  const BULK_CONCURRENCY = 4;
  const runBulk = async (label: string, jobs: Array<() => Promise<unknown>>) => {
    let failed = 0;
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        try {
          await job();
        } catch (error) {
          failed++;
          console.error(`${label}: one update failed`, error);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, jobs.length) }, worker));
    await refreshEntries();
    if (failed > 0) showCompletionMessage(t('common.someChangesNotSaved'));
  };

  // Fire-and-forget mutation with a safety net. The helpers below update
  // the server and then re-read; when the request failed they used to end as
  // an unhandled rejection - no message, no re-read - so the optimistic state
  // stayed on screen until the next resync. Now: log, re-read anyway (which
  // reverts the optimistic state), and tell the user once.
  const mutate = (label: string, request: () => Promise<unknown>, ...refreshers: Array<() => Promise<unknown>>) => {
    void (async () => {
      let failed = false;
      try {
        await request();
      } catch (error) {
        failed = true;
        console.error(`${label} failed`, error);
      }
      for (const refresh of refreshers) {
        try {
          await refresh();
        } catch (error) {
          console.error(`${label}: refresh failed`, error);
        }
      }
      if (failed) showCompletionMessage(t('common.someChangesNotSaved'));
    })();
  };

  const addEntry = (entry: Omit<Entry, 'id' | 'createdAt'>) => {
    mutate('addEntry', () => persistNewEntry(entry), refreshEntries);
  };

  const updateEntry = (id: string, updates: Partial<Entry>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const entry = entries.find(e => e.id === id);
    mutate('updateEntry', async () => {
      if (entry?.type === 'task') {
        const { completed, ...taskUpdates } = updates;
        await api.updateTask(id, withCompletionAttribution(id, taskUpdates as Partial<Task>));
      } else if (entry?.type === 'item') {
        const { blocked, blockedComment, flag, ...itemUpdates } = updates;
        await api.updateItem(id, itemUpdates);
      }
    }, refreshEntries);
  };

  const deleteEntry = (id: string) => {
    const entry = entries.find(e => e.id === id);
    mutate('deleteEntry', async () => {
      if (entry?.type === 'task') {
        await api.deleteTask(id);
      } else {
        await api.deleteItem(id);
      }
      setEntries(prev => prev.filter(e => e.id !== id));
    }, refreshEntries);
  };

  const completeEntry = (id: string) => {
    void updateEntry(id, { completed: true, status: 'done', completedAt: Date.now() });
  };

  const assignEntry = (id: string, userId: string) => {
    void updateEntry(id, { assignedTo: userId });
  };

  const refreshSettings = async () => {
    const settings = await api.getSettings();
    const currentUserId = pb.authStore.record?.id;
    setAppSettings((prev) => ({
      ...prev,
      ...settings,
      currentUserId,
      hasCompletedOnboarding: true,
    }));
  };

  // Keep the shared-view ref and state in sync. The ref lets async fetches
  // (refreshEntries) read the current scope without waiting for a re-render.
  const updateSharedView = (shared: boolean) => {
    sharedViewRef.current = shared;
    setSharedView(shared);
  };

  const refreshAll = async () => {
    setDataLoadState('loading');
    setLoadError(null);
    if (!pb.authStore.isValid || !pb.authStore.record) {
      setItems([]);
      setTasks([]);
      setNotes([]);
      setLabels([]);
      setShops([]);
      setSprints([]);
      setUsers([]);
      setInviteCodes([]);
      setRewards([]);
      setGoals([]);
      setProjects([]);
      setReminders([]);
      setEntries([]);
      setAppSettings(defaultSettings);
      entriesScopeRef.current = null;
      setDataLoadState('ready');
      return;
    }

    try {
      // GH#75: single family-scoped bootstrap call instead of 14 parallel
      // collection fetches. Sprints/rewards/goals/projects are deliberately
      // NOT fetched at boot (no component renders them from this state).
      const boot = await api.getBootstrap();
      // GH#76: resolve the shared-view scope synchronously from the boot
      // payload so the scope effect never starts a second, racing round-trip.
      updateSharedView(boot.users.length > 1);
      entriesScopeRef.current = boot.users.length > 1 ? 'shared' : 'all';
      setTasks(boot.tasks);
      setItems(boot.items);
      setNotes(boot.notes);
      setLabels(boot.labels);
      setShops(boot.shops);
      setUsers(boot.users);
      setInviteCodes(boot.invites);
      setReminders(boot.reminders);
      setEntries(buildEntries(boot.tasks, boot.items));
      if (boot.settings) {
        setAppSettings(prev => ({
          ...prev,
          ...boot.settings,
          currentUserId: pb.authStore.record?.id,
          hasCompletedOnboarding: true,
        }));
      } else {
        // No settings record yet — let the legacy path create the default.
        await refreshSettings();
      }
      setDataLoadState('ready');
    } catch (error) {
      // Fallback: legacy per-collection refresh MINUS the collections the UI
      // never shows (sprints/rewards/goals/projects).
      console.error('refreshAll: /api/bootstrap failed, falling back to per-collection refresh', error);
      try {
        await Promise.all([
          refreshItems(),
          refreshTasks(),
          refreshNotes(),
          refreshLabels(),
          refreshShops(),
          refreshUsers(),
          refreshInvites(),
          refreshReminders(),
          refreshSettings(),
          refreshEntries(),
        ]);
        setDataLoadState('ready');
      } catch (error2) {
        const kind = classifyLoadError(error2);
        if (kind === 'auth') {
          // Expired/revoked session: a retry can never succeed. Clearing the
          // auth store re-runs refreshAll (onChange) and the app shows login.
          pb.authStore.clear();
          return;
        }
        setDataLoadState('error');
        setLoadError(t(`errors.${kind}`));
      }
    }
  };

  useEffect(() => {
    const onChangeUnsub = pb.authStore.onChange(() => {
      void refreshAll();
    });

    void refreshAll();

    return () => {
      onChangeUnsub();
    };
  }, []);

  useEffect(() => {
    if (users.length > 1 && !sharedView) {
      updateSharedView(true);
    }
  }, [users.length]);

  // #77: realtime events are applied to local state instead of refetching
  // everything on every event (one grocery tick used to reload every list on
  // every device). Small collections are refetched, debounced, so a bulk
  // action produces one request instead of N. A full resync on focus/visibility
  // and every few minutes covers events PocketBase does not deliver (records
  // that stopped being readable).
  useEffect(() => {
    if (!pb.authStore.isValid) return;
    const myId = pb.authStore.record?.id;
    const timers: Record<string, number> = {};
    const debounced = (key: string, fn: () => Promise<unknown>, delay = 300) => {
      window.clearTimeout(timers[key]);
      timers[key] = window.setTimeout(() => { void fn().catch(() => undefined); }, delay);
    };

    const onTask = (e: { action: string; record: unknown }) => {
      const task = normalizeTask(e.record);
      const visible = isVisibleToMe(task, myId);
      setTasks((prev) => applyRealtimeEvent(prev, e.action, task, visible));
      const [entry] = buildEntries([task], []);
      setEntries((prev) => applyRealtimeEvent(prev, e.action, entry, visible));
    };
    const onItem = (e: { action: string; record: unknown }) => {
      const item = normalizeItem(e.record);
      const visible = isVisibleToMe(item, myId);
      setItems((prev) => applyRealtimeEvent(prev, e.action, item, visible));
      const [entry] = buildEntries([], [item]);
      setEntries((prev) => applyRealtimeEvent(prev, e.action, entry, visible));
    };

    const subscribeAll = async () => {
      await Promise.all([
        pb.collection('tasks').subscribe('*', onTask),
        pb.collection('items').subscribe('*', onItem),
        pb.collection('users').subscribe('*', () => debounced('users', refreshUsers)),
        pb.collection('labels').subscribe('*', () => debounced('labels', refreshLabels)),
        pb.collection('shops').subscribe('*', () => debounced('shops', refreshShops)),
        pb.collection('invite_codes').subscribe('*', () => debounced('invites', refreshInvites)),
        pb.collection('app_settings').subscribe('*', () => debounced('settings', refreshSettings)),
      ]);
    };

    void subscribeAll();

    const resync = () => debounced('resync', () => refreshEntries(), 1000);
    const onVisibility = () => { if (document.visibilityState === 'visible') resync(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', resync);
    const interval = window.setInterval(resync, 5 * 60 * 1000);

    return () => {
      Object.values(timers).forEach((id) => window.clearTimeout(id));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', resync);
      window.clearInterval(interval);
      pb.collection('tasks').unsubscribe();
      pb.collection('items').unsubscribe();
      pb.collection('users').unsubscribe();
      pb.collection('labels').unsubscribe();
      pb.collection('shops').unsubscribe();
      pb.collection('invite_codes').unsubscribe();
      pb.collection('app_settings').unsubscribe();
    };
  }, [pb.authStore.isValid]);

  useEffect(() => {
    if (!pb.authStore.isValid) return;
    if (dataLoadState === 'loading') return; // initial load owns the fetch
    const nextScope = sharedView ? 'shared' : 'all';
    // Data already loaded with the requested scope (boot resolved the shared
    // mode before its single fetch) — do not start a second round-trip.
    if (entriesScopeRef.current === nextScope) return;
    // Scope changed: re-fetch with the new filter. Never clear the current
    // lists before the replacement is loaded (no empty flash, no stale race).
    void refreshEntries(nextScope);
  }, [sharedView, dataLoadState]);

  useEffect(() => {
    if (completionMessage) {
      const timer = setTimeout(() => setCompletionMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [completionMessage]);

  // Auto-detect current active sprint
  useEffect(() => {
    const active = sprints.find((s) => s.status === 'active');
    setCurrentSprint(active ?? null);
  }, [sprints]);

  const addItem = (item: Omit<Item, 'id' | 'createdAt'>) => {
    mutate('createItem', () => api.createItem(item), refreshEntries);
  };

  const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => {
    mutate('createTask', () => api.createTask(task), refreshEntries);
  };

  const addNote = (note: Omit<Note, 'id' | 'createdAt'>) => {
    mutate('createNote', () => api.createNote(note), refreshNotes);
  };

  const addLabel = async (label: Omit<Label, 'id'>): Promise<Label | undefined> => {
    try {
      const created = await api.createLabel(label);
      await refreshLabels();
      return normalizeLabel(created);
    } catch (error: any) {
      const detail = error?.response?.data || error?.data || error?.message || error;
      console.error('addLabel failed — full error:', JSON.stringify(detail, null, 2));
      console.error('addLabel payload:', JSON.stringify(label));
      return undefined;
    }
  };

  const createLabel = addLabel;

  const addShop = (shop: Omit<Shop, 'id'>) => {
    mutate('createShop', () => api.createShop(shop), refreshShops);
  };

  const createShop = addShop;

  const addSprint = (sprint: Omit<Sprint, 'id'>) => {
    mutate('createSprint', () => api.createSprint(sprint), refreshSprints);
  };

  const addUser = (user: User) => {
    setUsers((prev) => [...prev, user]);
  };

  const updateItem = (id: string, updates: Partial<Item>) => {
    mutate('updateItem', () => api.updateItem(id, updates), refreshEntries);
  };

  // Completion attribution: the person who ticks the box is the completer -
  // not the assignee - and leaving the done state clears it. Callers that pass
  // completedBy explicitly keep control.
  const withCompletionAttribution = (id: string, updates: Partial<Task>): Partial<Task> => {
    if (!('status' in updates) || 'completedBy' in updates) return updates;
    const wasDone = tasks.find((t) => t.id === id)?.status === 'done';
    if (updates.status === 'done') {
      if (wasDone) return updates;
      return { ...updates, completedBy: pb.authStore.record?.id || appSettings.currentUserId || undefined };
    }
    return { ...updates, completedBy: undefined };
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const attributed = withCompletionAttribution(id, updates);
    mutate('updateTask', () => api.updateTask(id, attributed), refreshEntries);
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    mutate('updateNote', () => api.updateNote(id, updates), refreshNotes);
  };

  const updateLabel = (id: string, updates: Partial<Label>) => {
    mutate('updateLabel', () => api.updateLabel(id, updates), refreshLabels);
  };

  const updateShop = (id: string, updates: Partial<Shop>) => {
    mutate('updateShop', () => api.updateShop(id, updates), refreshShops);
  };

  const updateAppSettings = async (settings: Partial<AppSettings>): Promise<boolean> => {
    const previous = appSettings;
    setAppSettings((prev) => ({ ...prev, ...settings }));
    try {
      await api.updateSettings(settings);
      return true;
    } catch (error) {
      setAppSettings(previous);
      const message = error instanceof Error ? error.message : t('settings.notificationsSaveFailed');
      showCompletionMessage(message);
      return false;
    }
  };

  const updateUser = async (id: string, updates: Partial<User>): Promise<boolean> => {
    try {
      await api.updateUser(id, updates);
      await refreshUsers();
      if (typeof updates.active !== 'undefined') {
        showCompletionMessage(updates.active ? t('settings.memberUnblocked') : t('settings.memberBlocked'));
      } else if (typeof updates.role !== 'undefined') {
        showCompletionMessage(t('settings.roleUpdated'));
      }
      return true;
    } catch (error) {
      if (isInvalidOldPasswordError(error)) {
        showCompletionMessage(t('settings.currentPasswordIncorrect'));
        return false;
      }
      const message = error instanceof Error ? error.message : 'Failed to update member';
      showCompletionMessage(message);
      return false;
    }
  };

  const deleteUser = async (id: string): Promise<boolean> => {
    try {
      await api.deleteUser(id);
      await refreshUsers();
      await Promise.allSettled([refreshEntries(), refreshNotes()]);
      showCompletionMessage(t('settings.memberDeleted'));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete member';
      showCompletionMessage(message);
      return false;
    }
  };

  const deleteItem = (id: string) => {
    mutate('deleteItem', () => api.deleteItem(id), refreshEntries, refreshNotes);
  };

  const deleteTask = (id: string) => {
    mutate('deleteTask', () => api.deleteTask(id), refreshEntries, refreshNotes);
  };

  const deleteTasks = (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) return;
    mutate('deleteTasks', () => api.deleteTasks(uniqueIds), refreshEntries, refreshNotes);
  };

  const deleteNote = (id: string) => {
    mutate('deleteNote', () => api.deleteNote(id), refreshNotes);
  };

  const deleteLabel = (id: string) => {
    mutate('deleteLabel', () => api.deleteLabel(id), refreshLabels, refreshEntries, refreshNotes);
  };

  const deleteShop = (id: string) => {
    mutate('deleteShop', () => api.deleteShop(id), refreshShops);
  };

  const deleteSprint = (id: string) => {
    mutate('deleteSprint', () => api.deleteSprint(id), refreshSprints);
  };

  const updateSprintFn = (id: string, updates: Partial<Sprint>) => {
    mutate('updateSprint', () => api.updateSprint(id, updates), refreshSprints);
  };

  const startSprint = (id: string) => {
    mutate('updateSprint', () => api.updateSprint(id, { status: 'active' }), refreshSprints);
  };

  const completeSprint = (id: string) => {
    // after the refresh: archive the completed tasks of this sprint
    mutate('completeSprint', () => api.updateSprint(id, { status: 'completed' }), refreshSprints, async () => { archiveCompletedSprintTasks(id); });
  };

  const archiveCompletedSprintTasks = (sprintId?: string) => {
    const now = Date.now();
    const retention = appSettings.archiveRetention || 0;
    const deleteAfter = retention > 0 ? now + retention * 24 * 60 * 60 * 1000 : undefined;
    const sprint = sprintId ? sprints.find((s) => s.id === sprintId) : currentSprint;
    if (!sprint) return;

    const done = effectiveTasks.filter((task) => task.status === 'done' && task.sprintId === sprint.id);
    void runBulk('archiveCompletedSprintTasks', done.map((task) => () => api.updateTask(task.id, { archived: true, archivedAt: now, deleteAfter })));
  };

  const archiveAllDoneTasks = () => {
    const now = Date.now();
    const retention = appSettings.archiveRetention || 0;
    const deleteAfter = retention > 0 ? now + retention * 24 * 60 * 60 * 1000 : undefined;

    const done = effectiveTasks.filter((task) => task.status === 'done' && !task.archived);
    void runBulk('archiveAllDoneTasks', done.map((task) => () => api.updateTask(task.id, { archived: true, archivedAt: now, deleteAfter })));
  };

  const deleteArchivedTasks = () => {
    const ids = effectiveTasks.filter((task) => task.archived).map((task) => task.id);
    deleteTasks(ids);
  };

  const cleanupExpiredArchives = () => {
    const now = Date.now();
    const ids = effectiveTasks
      .filter((task) => task.archived && task.deleteAfter && task.deleteAfter < now)
      .map((task) => task.id);
    deleteTasks(ids);
  };

  const toggleChipFilter = (type: string, id: string, label?: string, color?: string) => {
    setActiveChipFilters((prev) => {
      const exists = prev.find((f) => f.type === type && f.id === id);
      const next = exists ? prev.filter((f) => f !== exists) : [...prev, { type, id, label, color }];
      writeFiltersToUrl(next);
      return next;
    });
  };

  const clearChipFilters = () => {
    setActiveChipFilters([]);
    writeFiltersToUrl([]);
  };

  const isChipFilterActive = (type: string, id: string) =>
    activeChipFilters.some((f) => f.type === type && f.id === id);

  const showCompletionMessage = (message: string) => setCompletionMessage(message);

  const moveTaskToStatus = (taskId: string, status: 'backlog' | 'todo' | 'done') => {
    // Moving OUT of 'done' must clear completion metadata or PocketBase keeps
    // the old completed_at (GH#80) — the done-today counter would keep counting.
    updateTask(taskId, status === 'done' ? { status, completedAt: Date.now() } : { status, completedAt: undefined, completedBy: undefined });
  };

  const createNewSprint = () => {
    const now = new Date();
    const duration = appSettings.sprintDuration || '2weeks';
    const startDay = appSettings.sprintStartDay ?? 1;
    let durationDays = 14;

    if (duration === '1week') durationDays = 7;
    if (duration === '3weeks') durationDays = 21;
    if (duration === '1month') durationDays = 30;

    const currentDay = now.getDay();
    let daysUntilStart = startDay - currentDay;
    if (daysUntilStart <= 0) daysUntilStart += 7;

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + daysUntilStart);
    startDate.setHours(0, 0, 0, 0);

    const sprint: Omit<Sprint, 'id'> = {
      name: `Sprint ${sprints.length + 1}`,
      startDate: startDate.getTime(),
      endDate: startDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
      duration: duration as SprintDuration,
      weekNumber: getISOWeek(startDate),
      year: startDate.getFullYear(),
      status: 'planned',
    };

    addSprint(sprint);
  };

  // Conversions create the copy FIRST and remove the original only once the
  // copy exists. Firing both as independent calls meant a failed create
  // (validation, offline, 429) left the user with neither.
  const convertTaskToItem = (taskId: string) => {
    const task = effectiveTasks.find((t) => t.id === taskId);
    if (!task) return;
    // The copy must exist before the original is removed (#238): a failed
    // create throws before deleteTask runs, and mutate() reports it.
    mutate('convertTaskToItem', async () => {
      await api.createItem({ title: task.title, completed: false, labels: task.labels });
      await api.deleteTask(taskId);
    }, refreshEntries);
  };

  const convertItemToTask = (itemId: string) => {
    const item = effectiveItems.find((i) => i.id === itemId);
    if (!item) return;
    mutate('convertItemToTask', async () => {
      await api.createTask({ title: item.title, status: 'todo', blocked: false, labels: item.labels, flag: false });
      await api.deleteItem(itemId);
    }, refreshEntries);
  };

  const swapEntity = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const { id: _originalId, createdAt: _createdAt, ...fields } = entry;
    const copy: Omit<Entry, 'id' | 'createdAt'> = entry.type === 'task'
      // Task → Grocery: preserve all fields
      ? { ...fields, type: 'item', completed: false, status: 'todo' as const, blocked: false, flag: false }
      // Grocery → Task: preserve all fields
      : { ...fields, type: 'task', status: 'todo' as const, blocked: false, flag: false };
    // Create the copy first and delete the original only once it exists
    // (#238); a failed create throws before the delete and mutate() reports it.
    mutate('swapEntity', async () => {
      await persistNewEntry(copy);
      if (entry.type === 'task') {
        await api.deleteTask(id);
      } else {
        await api.deleteItem(id);
      }
      setEntries(prev => prev.filter(e => e.id !== id));
    }, refreshEntries);
  };

  const generateInviteCode = async (): Promise<InviteCode | null> => {
    try {
      const result = await api.createInvite({ code: '', expiresAt: 0 });
      await refreshInvites();
      const invite: InviteCode = {
        id: result.id,
        code: result.code,
        createdBy: result.created_by || appSettings.currentUserId,
        createdAt: Date.now(),
        expiresAt: new Date(result.expires_at).getTime(),
        used: false,
        type: result.type || 'human',
      };
      if (result.token) {
        invite.token = result.token;
      }
      return invite;
    } catch (error) {
      console.error('generateInviteCode failed:', error);
      return null;
    }
  };

  const deleteInviteCode = (id: string) => {
    mutate('deleteInvite', () => api.deleteInvite(id), refreshInvites);
  };

  const uncheckAllDoneTasks = () => {
    const done = effectiveTasks.filter((task) => task.status === 'done');
    void runBulk('uncheckAllDoneTasks', done.map((task) => () => api.updateTask(task.id, { status: 'todo', completedAt: undefined, completedBy: undefined })));
  };

  const uncheckAllDoneItems = () => {
    const done = effectiveItems.filter((item) => item.completed);
    void runBulk('uncheckAllDoneItems', done.map((item) => () => api.updateItem(item.id, { completed: false, quantity: 1 })));
  };

  const addReward = (reward: Omit<Reward, 'id'>) => {
    mutate('createReward', () => api.createReward(reward), refreshRewards);
  };

  const deleteReward = (id: string) => {
    mutate('deleteReward', () => api.deleteReward(id), refreshRewards);
  };

  const addGoal = (goal: Omit<Goal, 'id'>) => {
    mutate('createGoal', () => api.createGoal(goal), refreshGoals);
  };

  const updateGoalFn = (id: string, updates: Partial<Goal>) => {
    mutate('updateGoal', () => api.updateGoal(id, updates), refreshGoals);
  };

  const deleteGoal = (id: string) => {
    mutate('deleteGoal', () => api.deleteGoal(id), refreshGoals);
  };

  // Derived: total points earned by the current user from rewards
  const totalPoints = useMemo(() => {
    const currentUserId = pb.authStore.record?.id;
    return rewards
      .filter(r => r.earnedBy === currentUserId || !r.earnedBy)
      .reduce((sum, r) => sum + r.points, 0);
  }, [rewards]);

  const updateReward = (id: string, updates: Partial<Reward>) => {
    mutate('updateReward', async () => {
      const pbUpdates: Record<string, unknown> = {};
      if (updates.title !== undefined) pbUpdates.title = updates.title;
      if (updates.points !== undefined) pbUpdates.points = updates.points;
      if (updates.earnedBy !== undefined) pbUpdates.earned_by = updates.earnedBy;
      if (updates.earnedAt !== undefined) pbUpdates.earned_at = new Date(updates.earnedAt).toISOString();
      if (updates.reason !== undefined) pbUpdates.reason = updates.reason;
      if (updates.taskId !== undefined) pbUpdates.task_id = updates.taskId;
      if (updates.awardedBy !== undefined) pbUpdates.awarded_by = updates.awardedBy;
      await pb.collection('rewards').update(id, pbUpdates);
    }, refreshRewards);
  };

  const addProject = (project: Omit<Project, 'id' | 'createdAt'>) => {
    mutate('createProject', () => api.createProject(project), refreshProjects);
  };

  const updateProjectFn = (id: string, updates: Partial<Project>) => {
    mutate('updateProject', () => api.updateProject(id, updates), refreshProjects);
  };

  const deleteProject = (id: string) => {
    mutate('deleteProject', () => api.deleteProject(id), refreshProjects);
  };

  // --- Reminders ---
  const addReminder = (reminder: Omit<Reminder, 'id' | 'createdAt' | 'dismissed' | 'fired'>) => {
    mutate('createReminder', () => api.createReminder(reminder), refreshReminders);
  };

  const updateReminderFn = (id: string, updates: Partial<Reminder>) => {
    mutate('updateReminder', () => api.updateReminder(id, updates), refreshReminders);
  };

  const dismissReminder = (id: string) => {
    mutate('dismissReminder', () => api.dismissReminder(id), refreshReminders);
  };

  const deleteReminder = (id: string) => {
    mutate('deleteReminder', () => api.deleteReminder(id), refreshReminders);
  };

  const contextValue = useMemo(
    () => ({
      dataLoadState,
      loadError,
      retryLoad: refreshAll,
      items: effectiveItems,
      tasks: effectiveTasks,
      notes,
      labels,
      shops,
      sprints,
      users,
      inviteCodes,
      appSettings,
      progressStats,
      completionMessage,
      currentSprint,
      // Entry model
      entries,
      addEntry,
      updateEntry,
      deleteEntry,
      completeEntry,
      assignEntry,
      refreshEntries,
      // Legacy methods
      addItem,
      addTask,
      addNote,
      addLabel,
      createLabel,
      addShop,
      createShop,
      addSprint,
      addUser,
      updateItem,
      updateTask,
      updateNote,
      updateLabel,
      updateShop,
      updateAppSettings,
      updateUser,
      deleteUser,
      deleteItem,
      deleteTask,
      deleteTasks,
      deleteNote,
      deleteLabel,
      deleteShop,
      deleteSprint,
      updateSprint: updateSprintFn,
      startSprint,
      completeSprint,
      archiveCompletedSprintTasks,
      archiveAllDoneTasks,
      deleteArchivedTasks,
      cleanupExpiredArchives,
      activeChipFilters,
      toggleChipFilter,
      clearChipFilters,
      isChipFilterActive,
      showCompletionMessage,
      moveTaskToStatus,
      createNewSprint,
      convertTaskToItem,
      convertItemToTask,
      swapEntity,
      generateInviteCode,
      deleteInviteCode,
      uncheckAllDoneTasks,
      uncheckAllDoneItems,
      rewards,
      goals,
      projects,
      sharedView,
      totalPoints,
      addReward,
      deleteReward,
      updateReward,
      addGoal,
      updateGoal: updateGoalFn,
      deleteGoal,
      setSharedView: updateSharedView,
      refreshRewards,
      refreshGoals,
      addProject,
      updateProject: updateProjectFn,
      deleteProject,
      refreshProjects,
      reminders,
      addReminder,
      updateReminder: updateReminderFn,
      dismissReminder,
      deleteReminder,
      refreshReminders,
    }),
    [
      effectiveItems,
      effectiveTasks,
      notes,
      labels,
      shops,
      sprints,
      users,
      inviteCodes,
      rewards,
      goals,
      projects,
      sharedView,
      totalPoints,
      appSettings,
      progressStats,
      activeChipFilters,
      completionMessage,
      currentSprint,
      reminders,
      entries,
      dataLoadState,
      loadError,
    ],
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};
