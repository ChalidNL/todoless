import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getISOWeek } from '../utils/dateUtils';
import { api } from '../lib/pocketbase-client';
import { t } from '../i18n/translations';
import { pb } from '../lib/pocketbase';

const FILTER_PARAM_KEY = 'filters';

interface ChipFilter { type: string; id: string; label?: string; color?: string; }

// Read filters from URL search params
function readFiltersFromUrl(): { labelFilters: string[]; chipFilters: ChipFilter[] } {
  const params = new URLSearchParams(window.location.search);
  const filtersParam = params.get(FILTER_PARAM_KEY);
  if (!filtersParam) return { labelFilters: [], chipFilters: [] };

  const labelFilters: string[] = [];
  const chipFilters: ChipFilter[] = [];

  for (const part of filtersParam.split(',')) {
    const [type, ...idParts] = part.split(':');
    const id = idParts.join(':');
    if (!type || !id) continue;
    if (type === 'label') {
      labelFilters.push(id);
    } else {
      chipFilters.push({ type, id });
    }
  }

  return { labelFilters, chipFilters };
}

// Write filters to URL search params
function writeFiltersToUrl(labelFilters: string[], chipFilters: ChipFilter[]) {
  const parts: string[] = [];
  for (const lid of labelFilters) parts.push(`label:${lid}`);
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
  Filter,
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
  linkedItemIds: entry.linkedItemIds,
  linkedNoteIds: entry.linkedNoteIds,
  subtaskIds: entry.subtaskIds,
  focus: entry.focus ?? false,
  linkedTo: entry.linkedTo,
  linkedType: entry.linkedType,
  flag: entry.flag ?? false,
  createdAt: entry.createdAt,
  createdBy: entry.createdBy,
});

interface AppContextType {
  items: Item[];
  tasks: Task[];
  notes: Note[];
  labels: Label[];
  shops: Shop[];
  filters: Filter[];
  sprints: Sprint[];
  users: User[];
  inviteCodes: InviteCode[];
  rewards: Reward[];
  goals: Goal[];
  projects: Project[];
  sharedView: boolean;
  appSettings: AppSettings;
  progressStats: ProgressStats;
  activeLabelFilters: string[];
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
  addLabel: (label: Omit<Label, 'id'>) => void;
  createLabel: (label: Omit<Label, 'id'>) => void;
  addShop: (shop: Omit<Shop, 'id'>) => void;
  createShop: (shop: Omit<Shop, 'id'>) => void;
  addFilter: (filter: Omit<Filter, 'id'>) => void;
  addSprint: (sprint: Omit<Sprint, 'id'>) => void;
  addUser: (user: User) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  updateLabel: (id: string, updates: Partial<Label>) => void;
  updateShop: (id: string, updates: Partial<Shop>) => void;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  updateUser: (id: string, updates: Partial<User>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  deleteItem: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteNote: (id: string) => void;
  deleteLabel: (id: string) => void;
  deleteShop: (id: string) => void;
  deleteFilter: (id: string) => void;
  deleteSprint: (id: string) => void;
  updateSprint: (id: string, updates: Partial<Sprint>) => void;
  startSprint: (id: string) => void;
  completeSprint: (id: string) => void;
  archiveCompletedSprintTasks: (sprintId?: string) => void;
  archiveAllDoneTasks: () => void;
  deleteArchivedTasks: () => void;
  cleanupExpiredArchives: () => void;
  moveFilterUp: (id: string) => void;
  moveFilterDown: (id: string) => void;
  toggleLabelFilter: (labelId: string) => void;
  clearLabelFilters: () => void;
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

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [sharedView, setSharedView] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultSettings);
  const [progressStats, setProgressStats] = useState<ProgressStats>({
    tasksCompletedThisWeek: 0,
    lastWeekReset: getWeekStart(),
  });
  const [activeLabelFilters, setActiveLabelFilters] = useState<string[]>(() => readFiltersFromUrl().labelFilters);
  const [activeChipFilters, setActiveChipFilters] = useState<ChipFilter[]>(() => readFiltersFromUrl().chipFilters);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);

  // Entry model state
  const [entries, setEntries] = useState<Entry[]>([]);

  // Derive tasks/items from entries via useMemo
  const derivedTasks = useMemo(() => entries.filter(e => e.type === 'task').map(entryToTask), [entries]);
  const derivedItems = useMemo(() => entries.filter(e => e.type === 'item').map(entryToItem), [entries]);

  // Use derived or direct state - prefer entries data when available, fallback to legacy state
  const effectiveTasks = derivedTasks.length > 0 ? derivedTasks : tasks;
  const effectiveItems = derivedItems.length > 0 ? derivedItems : items;

  const refreshItems = async () => setItems(await api.getItems());
  const refreshTasks = async () => setTasks(await api.getTasks());
  const refreshNotes = async () => setNotes(await api.getNotes());
  const refreshLabels = async () => setLabels(await api.getLabels());
  const refreshShops = async () => setShops(await api.getShops());
  const refreshSprints = async () => setSprints(await api.getSprints());
  const refreshUsers = async () => setUsers(await api.getUsers());
  const refreshInvites = async () => setInviteCodes(await api.getInvites());
  const refreshRewards = async () => setRewards(await api.getRewards());
  const refreshGoals = async () => setGoals(await api.getGoals());
  const refreshProjects = async () => setProjects(await api.getProjects());
  const refreshReminders = async () => setReminders(await api.getReminders());

  // Entry model refresh - combines tasks + items into unified list
  const refreshEntries = async () => {
    const [fetchedTasks, fetchedItems] = await Promise.all([
      api.getTasks(),
      api.getItems(),
    ]);
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
    setTasks(fetchedTasks);
    setItems(fetchedItems);
    setEntries([...taskEntries, ...itemEntries]);
  };

  const addEntry = (entry: Omit<Entry, 'id' | 'createdAt'>) => {
    void (async () => {
      if (entry.type === 'task') {
        const { type, completed, ...taskData } = entry;
        await api.createTask({ ...taskData, status: completed ? 'done' : 'todo' });
      } else {
        const { type, status, blocked, blockedComment, flag, ...itemData } = entry;
        await api.createItem(itemData);
      }
      await refreshEntries();
    })();
  };

  const updateEntry = (id: string, updates: Partial<Entry>) => {
    void (async () => {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      const entry = entries.find(e => e.id === id);
      if (entry?.type === 'task') {
        const { type, completed, ...taskUpdates } = updates;
        await api.updateTask(id, taskUpdates);
      } else if (entry?.type === 'item') {
        const { type, status, blocked, blockedComment, flag, ...itemUpdates } = updates;
        await api.updateItem(id, itemUpdates);
      }
      await refreshEntries();
    })();
  };

  const deleteEntry = (id: string) => {
    void (async () => {
      const entry = entries.find(e => e.id === id);
      if (entry?.type === 'task') {
        await api.deleteTask(id);
      } else {
        await api.deleteItem(id);
      }
      setEntries(prev => prev.filter(e => e.id !== id));
      await refreshEntries();
    })();
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

  const refreshAll = async () => {
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
      return;
    }

    await Promise.all([
      refreshItems(),
      refreshTasks(),
      refreshNotes(),
      refreshLabels(),
      refreshShops(),
      refreshSprints(),
      refreshUsers(),
      refreshInvites(),
      refreshRewards(),
      refreshGoals(),
      refreshProjects(),
      refreshReminders(),
      refreshSettings(),
      refreshEntries(),
    ]);
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
      setSharedView(true);
    }
  }, [users.length]);

  useEffect(() => {
    if (!pb.authStore.isValid) return;

    const subscribeAll = async () => {
      await Promise.all([
        pb.collection('tasks').subscribe('*', () => void refreshEntries()),
        pb.collection('items').subscribe('*', () => void refreshEntries()),
        pb.collection('users').subscribe('*', () => void refreshUsers()),
        pb.collection('labels').subscribe('*', () => void refreshLabels()),
        pb.collection('shops').subscribe('*', () => void refreshShops()),
        pb.collection('invite_codes').subscribe('*', () => void refreshInvites()),
        pb.collection('app_settings').subscribe('*', () => void refreshSettings()),
      ]);
    };

    void subscribeAll();

    return () => {
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
    if (sharedView) {
      void (async () => {
        setEntries([]);
        setTasks(await api.getSharedTasks());
        setItems(await api.getSharedItems());
      })();
    } else {
      void refreshEntries();
    }
  }, [sharedView]);

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
    void (async () => {
      await api.createItem(item);
      await refreshEntries();
    })();
  };

  const addTask = (task: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => {
    void (async () => {
      try {
        await api.createTask(task);
        await refreshEntries();
      } catch (error) {
        console.error('addTask failed:', error);
      }
    })();
  };

  const addNote = (note: Omit<Note, 'id' | 'createdAt'>) => {
    void (async () => {
      await api.createNote(note);
      await refreshNotes();
    })();
  };

  const addLabel = (label: Omit<Label, 'id'>) => {
    void (async () => {
      await api.createLabel(label);
      await refreshLabels();
    })();
  };

  const createLabel = addLabel;

  const addShop = (shop: Omit<Shop, 'id'>) => {
    void (async () => {
      await api.createShop(shop);
      await refreshShops();
    })();
  };

  const createShop = addShop;

  const addFilter = (filter: Omit<Filter, 'id'>) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    setFilters((prev) => [...prev, { ...filter, id }]);
  };

  const addSprint = (sprint: Omit<Sprint, 'id'>) => {
    void (async () => {
      await api.createSprint(sprint);
      await refreshSprints();
    })();
  };

  const addUser = (user: User) => {
    setUsers((prev) => [...prev, user]);
  };

  const updateItem = (id: string, updates: Partial<Item>) => {
    void (async () => {
      await api.updateItem(id, updates);
      await refreshEntries();
    })();
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    void (async () => {
      await api.updateTask(id, updates);
      await refreshEntries();
    })();
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    void (async () => {
      await api.updateNote(id, updates);
      await refreshNotes();
    })();
  };

  const updateLabel = (id: string, updates: Partial<Label>) => {
    void (async () => {
      await api.updateLabel(id, updates);
      await refreshLabels();
    })();
  };

  const updateShop = (id: string, updates: Partial<Shop>) => {
    void (async () => {
      await api.updateShop(id, updates);
      await refreshShops();
    })();
  };

  const updateAppSettings = (settings: Partial<AppSettings>) => {
    setAppSettings((prev) => ({ ...prev, ...settings }));
    void api.updateSettings(settings);
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
    void (async () => {
      await api.deleteItem(id);
      await refreshEntries();
      await refreshNotes();
    })();
  };

  const deleteTask = (id: string) => {
    void (async () => {
      await api.deleteTask(id);
      await refreshEntries();
      await refreshNotes();
    })();
  };

  const deleteNote = (id: string) => {
    void (async () => {
      await api.deleteNote(id);
      await refreshNotes();
    })();
  };

  const deleteLabel = (id: string) => {
    void (async () => {
      await api.deleteLabel(id);
      await Promise.all([refreshLabels(), refreshEntries(), refreshNotes()]);
    })();
  };

  const deleteShop = (id: string) => {
    void (async () => {
      await api.deleteShop(id);
      await refreshShops();
    })();
  };

  const deleteFilter = (id: string) => {
    setFilters((prev) => prev.filter((filter) => filter.id !== id));
  };

  const deleteSprint = (id: string) => {
    void (async () => {
      await api.deleteSprint(id);
      await refreshSprints();
    })();
  };

  const updateSprintFn = (id: string, updates: Partial<Sprint>) => {
    void (async () => {
      await api.updateSprint(id, updates);
      await refreshSprints();
    })();
  };

  const startSprint = (id: string) => {
    void (async () => {
      await api.updateSprint(id, { status: 'active' });
      await refreshSprints();
    })();
  };

  const completeSprint = (id: string) => {
    void (async () => {
      await api.updateSprint(id, { status: 'completed' });
      await refreshSprints();
      // Archive completed tasks for this sprint
      archiveCompletedSprintTasks(id);
    })();
  };

  const archiveCompletedSprintTasks = (sprintId?: string) => {
    const now = Date.now();
    const retention = appSettings.archiveRetention || 0;
    const deleteAfter = retention > 0 ? now + retention * 24 * 60 * 60 * 1000 : undefined;
    const sprint = sprintId ? sprints.find((s) => s.id === sprintId) : currentSprint;
    if (!sprint) return;

    effectiveTasks
      .filter((task) => task.status === 'done' && task.sprintId === sprint.id)
      .forEach((task) => updateTask(task.id, { archived: true, archivedAt: now, deleteAfter }));
  };

  const archiveAllDoneTasks = () => {
    const now = Date.now();
    const retention = appSettings.archiveRetention || 0;
    const deleteAfter = retention > 0 ? now + retention * 24 * 60 * 60 * 1000 : undefined;

    effectiveTasks.filter((task) => task.status === 'done' && !task.archived).forEach((task) => {
      updateTask(task.id, { archived: true, archivedAt: now, deleteAfter });
    });
  };

  const deleteArchivedTasks = () => {
    effectiveTasks.filter((task) => task.archived).forEach((task) => deleteTask(task.id));
  };

  const cleanupExpiredArchives = () => {
    const now = Date.now();
    effectiveTasks.filter((task) => task.archived && task.deleteAfter && task.deleteAfter < now).forEach((task) => deleteTask(task.id));
  };

  const moveFilterUp = (id: string) => {
    setFilters((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index <= 0) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index - 1, 0, item);
      return next;
    });
  };

  const moveFilterDown = (id: string) => {
    setFilters((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index < 0 || index >= prev.length - 1) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(index + 1, 0, item);
      return next;
    });
  };

  const toggleLabelFilter = (labelId: string) => {
    setActiveLabelFilters((prev) => {
      const next = prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId];
      writeFiltersToUrl(next, activeChipFilters);
      return next;
    });
  };

  const clearLabelFilters = () => {
    setActiveLabelFilters([]);
    writeFiltersToUrl([], activeChipFilters);
  };

  const toggleChipFilter = (type: string, id: string, label?: string, color?: string) => {
    setActiveChipFilters((prev) => {
      const exists = prev.find((f) => f.type === type && f.id === id);
      const next = exists ? prev.filter((f) => f !== exists) : [...prev, { type, id, label, color }];
      const currentLabelFilters = activeLabelFilters;
      writeFiltersToUrl(currentLabelFilters, next);
      return next;
    });
  };

  const clearChipFilters = () => {
    setActiveChipFilters([]);
    const currentLabelFilters = activeLabelFilters;
    writeFiltersToUrl(currentLabelFilters, []);
  };

  const isChipFilterActive = (type: string, id: string) =>
    activeChipFilters.some((f) => f.type === type && f.id === id);

  const showCompletionMessage = (message: string) => setCompletionMessage(message);

  const moveTaskToStatus = (taskId: string, status: 'backlog' | 'todo' | 'done') => {
    updateTask(taskId, { status });
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

  const convertTaskToItem = (taskId: string) => {
    const task = effectiveTasks.find((t) => t.id === taskId);
    if (!task) return;
    addItem({ title: task.title, completed: false, labels: task.labels });
    deleteTask(taskId);
  };

  const convertItemToTask = (itemId: string) => {
    const item = effectiveItems.find((i) => i.id === itemId);
    if (!item) return;
    addTask({ title: item.title, status: 'todo', blocked: false, labels: item.labels, flag: false });
    deleteItem(itemId);
  };

  const swapEntity = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    if (entry.type === 'task') {
      // Task → Grocery: preserve all fields via addEntry/deleteEntry
      addEntry({
        ...entry,
        type: 'item',
        completed: false,
        status: 'todo' as const,
        blocked: false,
        flag: false,
      });
      deleteEntry(id);
    } else {
      // Grocery → Task: preserve all fields via addEntry/deleteEntry
      addEntry({
        ...entry,
        type: 'task',
        status: 'todo' as const,
        blocked: false,
        flag: false,
      });
      deleteEntry(id);
    }
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
    void (async () => {
      await api.deleteInvite(id);
      await refreshInvites();
    })();
  };

  const uncheckAllDoneTasks = () => {
    effectiveTasks.filter((task) => task.status === 'done').forEach((task) => {
      updateTask(task.id, { status: 'todo', completedAt: undefined });
    });
  };

  const uncheckAllDoneItems = () => {
    effectiveItems.filter((item) => item.completed).forEach((item) => updateItem(item.id, { completed: false, quantity: 1 }));
  };

  const addReward = (reward: Omit<Reward, 'id'>) => {
    void (async () => {
      await api.createReward(reward);
      await refreshRewards();
    })();
  };

  const deleteReward = (id: string) => {
    void (async () => {
      await api.deleteReward(id);
      await refreshRewards();
    })();
  };

  const addGoal = (goal: Omit<Goal, 'id'>) => {
    void (async () => {
      await api.createGoal(goal);
      await refreshGoals();
    })();
  };

  const updateGoalFn = (id: string, updates: Partial<Goal>) => {
    void (async () => {
      await api.updateGoal(id, updates);
      await refreshGoals();
    })();
  };

  const deleteGoal = (id: string) => {
    void (async () => {
      await api.deleteGoal(id);
      await refreshGoals();
    })();
  };

  // Derived: total points earned by the current user from rewards
  const totalPoints = useMemo(() => {
    const currentUserId = pb.authStore.record?.id;
    return rewards
      .filter(r => r.earnedBy === currentUserId || !r.earnedBy)
      .reduce((sum, r) => sum + r.points, 0);
  }, [rewards]);

  const updateReward = (id: string, updates: Partial<Reward>) => {
    void (async () => {
      const pbUpdates: Record<string, unknown> = {};
      if (updates.title !== undefined) pbUpdates.title = updates.title;
      if (updates.points !== undefined) pbUpdates.points = updates.points;
      if (updates.earnedBy !== undefined) pbUpdates.earned_by = updates.earnedBy;
      if (updates.earnedAt !== undefined) pbUpdates.earned_at = new Date(updates.earnedAt).toISOString();
      if (updates.reason !== undefined) pbUpdates.reason = updates.reason;
      if (updates.taskId !== undefined) pbUpdates.task_id = updates.taskId;
      if (updates.awardedBy !== undefined) pbUpdates.awarded_by = updates.awardedBy;
      await pb.collection('rewards').update(id, pbUpdates);
      await refreshRewards();
    })();
  };

  const addProject = (project: Omit<Project, 'id' | 'createdAt'>) => {
    void (async () => {
      await api.createProject(project);
      await refreshProjects();
    })();
  };

  const updateProjectFn = (id: string, updates: Partial<Project>) => {
    void (async () => {
      await api.updateProject(id, updates);
      await refreshProjects();
    })();
  };

  const deleteProject = (id: string) => {
    void (async () => {
      await api.deleteProject(id);
      await refreshProjects();
    })();
  };

  // --- Reminders ---
  const addReminder = (reminder: Omit<Reminder, 'id' | 'createdAt' | 'dismissed' | 'fired'>) => {
    void (async () => {
      await api.createReminder(reminder);
      await refreshReminders();
    })();
  };

  const updateReminderFn = (id: string, updates: Partial<Reminder>) => {
    void (async () => {
      await api.updateReminder(id, updates);
      await refreshReminders();
    })();
  };

  const dismissReminder = (id: string) => {
    void (async () => {
      await api.dismissReminder(id);
      await refreshReminders();
    })();
  };

  const deleteReminder = (id: string) => {
    void (async () => {
      await api.deleteReminder(id);
      await refreshReminders();
    })();
  };

  const contextValue = useMemo(
    () => ({
      items: effectiveItems,
      tasks: effectiveTasks,
      notes,
      labels,
      shops,
      filters,
      sprints,
      users,
      inviteCodes,
      appSettings,
      progressStats,
      activeLabelFilters,
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
      addFilter,
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
      deleteNote,
      deleteLabel,
      deleteShop,
      deleteFilter,
      deleteSprint,
      updateSprint: updateSprintFn,
      startSprint,
      completeSprint,
      archiveCompletedSprintTasks,
      archiveAllDoneTasks,
      deleteArchivedTasks,
      cleanupExpiredArchives,
      moveFilterUp,
      moveFilterDown,
      toggleLabelFilter,
      clearLabelFilters,
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
      setSharedView,
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
      filters,
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
      activeLabelFilters,
      activeChipFilters,
      completionMessage,
      currentSprint,
      reminders,
      entries,
    ],
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};
