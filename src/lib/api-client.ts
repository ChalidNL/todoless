/**
 * REST API client for Todoless.
 * 
 * Provides a clean, typed interface over the PocketBase API.
 * All UI components should use this client instead of calling PocketBase directly.
 */

import { pb } from './pocketbase';
import type {
  Task,
  Item,
  Note,
  Label,
  Shop,
  Sprint,
  CalendarEvent,
  Reminder,
  AppSettings,
  User,
  Reward,
  Goal,
} from '../types';

// --- Utility ---
const toISO = (timestamp?: number | string | null): string | null =>
  timestamp ? new Date(timestamp).toISOString() : null;

// --- Normalizers: PocketBase snake_case → Frontend camelCase ---
const normalizeUser = (r: any): User => ({
  id: r.id, email: r.email, name: r.name || r.email || [r.first_name, r.last_name].filter(Boolean).join(' ') || r.display_name || r.id || '?',
  role: (r.role || 'member') as User['role'], avatarUrl: r.avatar,
});

const normalizeTask = (r: any): Task => ({
  id: r.id, title: r.title, status: r.status || 'todo',
  blocked: !!r.blocked, blockedComment: r.blocked_comment,
  priority: r.priority, horizon: r.horizon, assignedTo: r.assigned_to,
  dueDate: r.due_date ? new Date(r.due_date).getTime() : undefined,
  startTime: r.start_time ? new Date(r.start_time).getTime() : undefined,
  endTime: r.end_time ? new Date(r.end_time).getTime() : undefined,
  allDay: !!r.all_day,
  repeatInterval: r.repeat_interval, completedAt: r.completed_at ? new Date(r.completed_at).getTime() : undefined,
  archived: !!r.archived, archivedAt: r.archived_at ? new Date(r.archived_at).getTime() : undefined,
  deleteAfter: r.delete_after ? new Date(r.delete_after).getTime() : undefined,
  isPrivate: !!r.is_private, labels: Array.isArray(r.labels) ? r.labels : [],
  subtaskIds: Array.isArray(r.subtask_ids) ? r.subtask_ids : [],
  focus: !!r.focus,
  linkedTo: r.linked_to, linkedType: r.linked_type, flag: !!r.flag,
  createdAt: r.created ? new Date(r.created).getTime() : Date.now(), createdBy: r.user,
});

const normalizeItem = (r: any): Item => ({
  id: r.id, title: r.title, completed: !!r.completed,
  focus: !!r.focus,
  shopId: r.shop_id, quantity: r.quantity, priority: r.priority,
  assignedTo: r.assigned_to, dueDate: r.due_date ? new Date(r.due_date).getTime() : undefined,
  labels: Array.isArray(r.labels) ? r.labels : [], isPrivate: !!r.is_private,
  linkedTaskIds: Array.isArray(r.linked_task_ids) ? r.linked_task_ids : [],
  linkedNoteIds: Array.isArray(r.linked_note_ids) ? r.linked_note_ids : [],
  createdAt: r.created ? new Date(r.created).getTime() : Date.now(), createdBy: r.user,
});

const normalizeNote = (r: any): Note => ({
  id: r.id, title: r.title, content: r.content || '', pinned: !!r.pinned,
  linkedType: r.linked_type, linkedTo: r.linked_to,
  linkedIds: Array.isArray(r.linked_ids) ? r.linked_ids : [],
  labels: Array.isArray(r.labels) ? r.labels : [],
  assignedTo: r.assigned_to, dueDate: r.due_date ? new Date(r.due_date).getTime() : undefined,
  repeatInterval: r.repeat_interval, isPrivate: !!r.is_private,
  createdAt: r.created ? new Date(r.created).getTime() : Date.now(),
  createdBy: r.user,
});

const normalizeLabel = (r: any): Label => ({
  id: r.id, name: r.name, color: r.color, isPrivate: !!r.is_private,
  createdBy: r.user,
});

const normalizeShop = (r: any): Shop => ({
  id: r.id, name: r.name, color: r.color,
});

const normalizeSprint = (r: any): Sprint => ({
  id: r.id, name: r.name,
  startDate: r.start_date ? new Date(r.start_date).getTime() : Date.now(),
  endDate: r.end_date ? new Date(r.end_date).getTime() : Date.now(),
  duration: r.duration || '2weeks', weekNumber: r.week_number || 1,
  year: r.year || new Date().getFullYear(), status: r.status || 'planned', createdBy: r.user,
});

const normalizeCalendarEvent = (r: any): CalendarEvent => ({
  id: r.id, title: r.title, description: r.description,
  startTime: r.start_time ? new Date(r.start_time).getTime() : Date.now(),
  endTime: r.end_time ? new Date(r.end_time).getTime() : Date.now(),
  allDay: !!r.all_day, createdAt: r.created ? new Date(r.created).getTime() : Date.now(), createdBy: r.user,
});

const normalizeSettings = (r: any): AppSettings => ({
  theme: r.theme || 'light', language: r.language || 'en',
  archiveRetention: r.archive_retention_days ?? 30, autoCleanup: r.auto_cleanup ?? true,
});

const normalizeReward = (r: any): Reward => ({
  id: r.id, title: r.title, points: r.points || 0, earnedBy: r.earned_by,
  earnedAt: r.earned_at ? new Date(r.earned_at).getTime() : undefined,
  reason: r.reason, taskId: r.task_id, awardedBy: r.awarded_by,
});

const normalizeGoal = (r: any): Goal => ({
  id: r.id, title: r.title, description: r.description,
  pointsRequired: r.points_required || 0, pointsCurrent: r.points_current || 0,
  targetUser: r.target_user, completed: !!r.completed,
  completedAt: r.completed_at ? new Date(r.completed_at).getTime() : undefined,
  createdBy: r.user,
});

const normalizeReminder = (r: any): Reminder => ({
  id: r.id, title: r.title, description: r.description,
  dueDate: r.due_date ? new Date(r.due_date).getTime() : Date.now(),
  endTime: r.end_time ? new Date(r.end_time).getTime() : undefined,
  recurring: r.recurring, assignee: r.assignee,
  labels: Array.isArray(r.labels) ? r.labels : [],
  flagged: !!r.flagged, isPrivate: !!r.is_private,
  linkedType: r.linked_type, linkedTo: r.linked_to,
  source: (r.source || 'manual') as Reminder['source'],
  dismissed: !!r.dismissed, dismissedAt: r.dismissed_at ? new Date(r.dismissed_at).getTime() : undefined,
  fired: !!r.fired,
  createdAt: r.created ? new Date(r.created).getTime() : Date.now(), createdBy: r.user,
});

// --- Auth helper ---
function requireAuth() {
  if (!pb.authStore.isValid || !pb.authStore.record) throw new Error('Not authenticated');
  return pb.authStore.record;
}

// --- API ---
export const api = {
  auth: {
    async login(email: string, password: string) {
      const data = await pb.collection('users').authWithPassword(email, password);
      return { token: pb.authStore.token, user: normalizeUser(data.record) };
    },
    async register(email: string, password: string, name: string, inviteCode?: string) {
      await pb.collection('users').create({
        email, password, passwordConfirm: password, name,
        username: email.split('@')[0], role: 'member',
      });
      if (inviteCode) {
        const invites = await pb.collection('invite_codes').getFullList({
          filter: `code = "${inviteCode.toUpperCase()}" && used = false`,
        });
        if (invites.length) {
          await pb.collection('invite_codes').update(invites[0].id, {
            used: true, used_by: pb.authStore.record?.id, used_at: new Date().toISOString(),
          });
        }
      }
      await pb.collection('users').authWithPassword(email, password);
      return { token: pb.authStore.token, user: normalizeUser(pb.authStore.record) };
    },
    logout() { pb.authStore.clear(); },
    async getCurrentUser() { return { user: normalizeUser(requireAuth()) }; },
  },

  tasks: {
    async list(status?: string): Promise<Task[]> {
      const userId = requireAuth().id;
      const list = await pb.collection('tasks').getFullList({ filter: `user = "${userId}"`, sort: '-created' });
      const tasks = list.map(normalizeTask);
      return status ? tasks.filter(t => t.status === status) : tasks;
    },
    async get(id: string): Promise<Task> { return normalizeTask(await pb.collection('tasks').getOne(id)); },
    async create(data: Partial<Task>): Promise<Task> {
      const record = await pb.collection('tasks').create({
        title: data.title, status: data.status || 'todo', blocked: data.blocked,
        blocked_comment: data.blockedComment, priority: data.priority, horizon: data.horizon,
        assigned_to: data.assignedTo, due_date: toISO(data.dueDate),
        start_time: toISO(data.startTime),
        end_time: toISO(data.endTime),
        all_day: data.allDay,
        repeat_interval: data.repeatInterval, labels: data.labels || [],
        is_private: data.isPrivate, archived: false, user: requireAuth().id,
        linked_to: data.linkedTo, linked_type: data.linkedType, flag: data.flag,
      } as any);
      return normalizeTask(record);
    },
    async update(id: string, data: Partial<Task>): Promise<Task> {
      const record = await pb.collection('tasks').update(id, {
        title: data.title, status: data.status, blocked: data.blocked,
        blocked_comment: data.blockedComment, priority: data.priority, horizon: data.horizon,
        assigned_to: data.assignedTo, due_date: toISO(data.dueDate),
        start_time: toISO(data.startTime),
        end_time: toISO(data.endTime),
        all_day: data.allDay,
        repeat_interval: data.repeatInterval, completed_at: toISO(data.completedAt),
        labels: data.labels, is_private: data.isPrivate, archived: data.archived,
        archived_at: toISO(data.archivedAt),
        linked_to: data.linkedTo, linked_type: data.linkedType, flag: data.flag,
      } as any);
      return normalizeTask(record);
    },
    async delete(id: string) { await pb.collection('tasks').delete(id); },
    async getCalendarTasks(start: number, end: number): Promise<Task[]> {
      const userId = requireAuth().id;
      const startISO = new Date(start).toISOString();
      const endISO = new Date(end).toISOString();
      const list = await pb.collection('tasks').getFullList({
        filter: `user = "${userId}" && due_date != "" && due_date >= "${startISO}" && due_date <= "${endISO}"`,
        sort: 'due_date',
      });
      return list.map(normalizeTask);
    },
  },

  items: {
    async list(): Promise<Item[]> {
      const userId = requireAuth().id;
      const list = await pb.collection('items').getFullList({ filter: `user = "${userId}"`, sort: '-created' });
      return list.map(normalizeItem);
    },
    async create(data: Partial<Item>): Promise<Item> {
      const record = await pb.collection('items').create({
        title: data.title, completed: data.completed, shop_id: data.shopId,
        focus: data.focus,
        quantity: data.quantity, priority: data.priority, assigned_to: data.assignedTo,
        due_date: toISO(data.dueDate), labels: data.labels || [],
        is_private: data.isPrivate, user: requireAuth().id,
      } as any);
      return normalizeItem(record);
    },
    async update(id: string, data: Partial<Item>): Promise<Item> {
      const record = await pb.collection('items').update(id, {
        title: data.title, completed: data.completed, shop_id: data.shopId,
        focus: data.focus,
        quantity: data.quantity, labels: data.labels, is_private: data.isPrivate,
      } as any);
      return normalizeItem(record);
    },
    async delete(id: string) { await pb.collection('items').delete(id); },
  },

  notes: {
    async list(): Promise<Note[]> {
      const userId = requireAuth().id;
      const list = await pb.collection('notes').getFullList({ filter: `user = "${userId}"`, sort: '-created' });
      return list.map(normalizeNote);
    },
    async create(data: Partial<Note>): Promise<Note> {
      const record = await pb.collection('notes').create({
        title: data.title, content: data.content, pinned: data.pinned,
        linked_type: data.linkedType, linked_to: data.linkedTo,
        linked_ids: data.linkedIds || [], labels: data.labels || [],
        assigned_to: data.assignedTo,
        due_date: toISO(data.dueDate),
        repeat_interval: data.repeatInterval,
        is_private: data.isPrivate, user: requireAuth().id,
      } as any);
      return normalizeNote(record);
    },
    async update(id: string, data: Partial<Note>): Promise<Note> {
      const record = await pb.collection('notes').update(id, {
        title: data.title, content: data.content, pinned: data.pinned,
        linked_type: data.linkedType, linked_to: data.linkedTo,
        linked_ids: data.linkedIds, labels: data.labels,
        assigned_to: data.assignedTo,
        due_date: toISO(data.dueDate),
        repeat_interval: data.repeatInterval,
        is_private: data.isPrivate,
      } as any);
      return normalizeNote(record);
    },
    async delete(id: string) { await pb.collection('notes').delete(id); },
  },

  labels: {
    async list(): Promise<Label[]> {
      const userId = requireAuth().id;
      const list = await pb.collection('labels').getFullList({ filter: `user = "${userId}" || is_private = false`, sort: 'name' });
      return list.map(normalizeLabel);
    },
    async create(data: Partial<Label>): Promise<Label> {
      const record = await pb.collection('labels').create({
        name: data.name, color: data.color, is_private: data.isPrivate, user: requireAuth().id,
      } as any);
      return normalizeLabel(record);
    },
    async update(id: string, data: Partial<Label>): Promise<Label> {
      const record = await pb.collection('labels').update(id, {
        name: data.name, color: data.color, is_private: data.isPrivate,
      } as any);
      return normalizeLabel(record);
    },
    async delete(id: string) { await pb.collection('labels').delete(id); },
  },

  shops: {
    async list(): Promise<Shop[]> {
      const userId = requireAuth().id;
      const list = await pb.collection('shops').getFullList({ filter: `user = "${userId}"`, sort: 'name' });
      return list.map(normalizeShop);
    },
    async create(data: Partial<Shop>): Promise<Shop> {
      const record = await pb.collection('shops').create({
        name: data.name, color: data.color, user: requireAuth().id,
      });
      return normalizeShop(record);
    },
    async update(id: string, data: Partial<Shop>): Promise<Shop> {
      return normalizeShop(await pb.collection('shops').update(id, { name: data.name, color: data.color }));
    },
    async delete(id: string) { await pb.collection('shops').delete(id); },
  },

  sprints: {
    async list(): Promise<Sprint[]> {
      const userId = requireAuth().id;
      const list = await pb.collection('sprints').getFullList({ filter: `user = "${userId}"`, sort: '-start_date' });
      return list.map(normalizeSprint);
    },
    async create(data: Partial<Sprint>): Promise<Sprint> {
      const record = await pb.collection('sprints').create({
        name: data.name, start_date: toISO(data.startDate) || new Date().toISOString(),
        end_date: toISO(data.endDate), duration: data.duration,
        week_number: data.weekNumber, year: data.year, user: requireAuth().id,
      } as any);
      return normalizeSprint(record);
    },
    async update(id: string, data: Partial<Sprint>): Promise<Sprint> {
      const record = await pb.collection('sprints').update(id, {
        name: data.name, start_date: toISO(data.startDate), end_date: toISO(data.endDate),
        duration: data.duration, week_number: data.weekNumber, year: data.year,
      } as any);
      return normalizeSprint(record);
    },
    async delete(id: string) { await pb.collection('sprints').delete(id); },
  },

  /** @deprecated Use api.tasks methods with calendar fields instead */
  calendar: {
    /** @deprecated Use api.tasks.getCalendarTasks() instead */
    async list(): Promise<CalendarEvent[]> {
      const userId = requireAuth().id;
      const list = await pb.collection('calendar_events').getFullList({ filter: `user = "${userId}"`, sort: 'start_time' });
      return list.map(normalizeCalendarEvent);
    },
    /** @deprecated Use api.tasks.create() with startTime/endTime/allDay instead */
    async create(data: Partial<CalendarEvent>): Promise<CalendarEvent> {
      const record = await pb.collection('calendar_events').create({
        title: data.title, description: data.description,
        start_time: toISO(data.startTime) || new Date().toISOString(),
        end_time: toISO(data.endTime), all_day: data.allDay, user: requireAuth().id,
      } as any);
      return normalizeCalendarEvent(record);
    },
    /** @deprecated Use api.tasks.update() with startTime/endTime/allDay instead */
    async update(id: string, data: Partial<CalendarEvent>): Promise<CalendarEvent> {
      const record = await pb.collection('calendar_events').update(id, {
        title: data.title, description: data.description,
        start_time: toISO(data.startTime), end_time: toISO(data.endTime), all_day: data.allDay,
      } as any);
      return normalizeCalendarEvent(record);
    },
    /** @deprecated Use api.tasks.delete() instead */
    async delete(id: string) { await pb.collection('calendar_events').delete(id); },
  },

  settings: {
    async get(): Promise<AppSettings> {
      const userId = requireAuth().id;
      const list = await pb.collection('app_settings').getFullList({ filter: `user = "${userId}"` });
      if (!list.length) {
        const record = await pb.collection('app_settings').create({
          user: userId, theme: 'light', language: 'en',
          archive_retention_days: 30, auto_cleanup: true,
        });
        return normalizeSettings(record);
      }
      return normalizeSettings(list[0]);
    },
    async update(data: Partial<AppSettings>): Promise<AppSettings> {
      const userId = requireAuth().id;
      const list = await pb.collection('app_settings').getFullList({ filter: `user = "${userId}"` });
      const payload = {
        theme: data.theme, language: data.language,
        archive_retention_days: data.archiveRetention, auto_cleanup: data.autoCleanup,
      } as any;
      if (list.length) return normalizeSettings(await pb.collection('app_settings').update(list[0].id, payload));
      return normalizeSettings(await pb.collection('app_settings').create({ user: userId, ...payload }));
    },
  },

  users: {
    async list(): Promise<User[]> {
      const list = await pb.collection('users').getFullList({ sort: 'name' });
      return list.map(normalizeUser);
    },
    async update(id: string, data: Partial<User>): Promise<User> {
      return normalizeUser(await pb.collection('users').update(id, { name: data.name, role: data.role }));
    },
  },

  rewards: {
    async list(): Promise<Reward[]> {
      return (await pb.collection('rewards').getFullList({ sort: '-created' })).map(normalizeReward);
    },
    async create(data: Partial<Reward>): Promise<Reward> {
      const record = await pb.collection('rewards').create({
        title: data.title, points: data.points, earned_by: data.earnedBy,
        earned_at: toISO(data.earnedAt) || new Date().toISOString(),
        reason: data.reason, task_id: data.taskId, awarded_by: data.awardedBy || requireAuth().id,
        user: requireAuth().id,
      } as any);
      return normalizeReward(record);
    },
    async delete(id: string) { await pb.collection('rewards').delete(id); },
  },

  goals: {
    async list(): Promise<Goal[]> {
      return (await pb.collection('goals').getFullList({ sort: '-created' })).map(normalizeGoal);
    },
    async create(data: Partial<Goal>): Promise<Goal> {
      const record = await pb.collection('goals').create({
        title: data.title, description: data.description,
        points_required: data.pointsRequired, points_current: data.pointsCurrent,
        target_user: data.targetUser, completed: false, user: requireAuth().id,
      } as any);
      return normalizeGoal(record);
    },
    async update(id: string, data: Partial<Goal>): Promise<Goal> {
      const record = await pb.collection('goals').update(id, {
        title: data.title, description: data.description,
        points_required: data.pointsRequired, points_current: data.pointsCurrent,
        target_user: data.targetUser, completed: data.completed, completed_at: toISO(data.completedAt),
      } as any);
      return normalizeGoal(record);
    },
    async delete(id: string) { await pb.collection('goals').delete(id); },
  },

  integrations: {
    async list(): Promise<any[]> {
      try {
        const userId = requireAuth().id;
        return await pb.collection('integrations').getFullList({ filter: `user = "${userId}"` });
      } catch { return []; }
    },
    async create(data: { type: string; api_url: string; api_key: string; config?: Record<string, unknown> }) {
      return await pb.collection('integrations').create({
        type: data.type, api_url: data.api_url, api_key: data.api_key,
        config_data: data.config || {}, enabled: true, user: requireAuth().id,
      });
    },
    async update(id: string, data: Partial<{ api_url: string; api_key: string; config?: Record<string, unknown>; enabled: boolean }>) {
      return await pb.collection('integrations').update(id, {
        api_url: data.api_url, api_key: data.api_key,
        config_data: data.config, enabled: data.enabled,
      });
    },
    async delete(id: string) { await pb.collection('integrations').delete(id); },
  },

  reminders: {
    async list(): Promise<Reminder[]> {
      const userId = requireAuth().id;
      const list = await pb.collection('reminders').getFullList({
        filter: `user = "${userId}" && dismissed = false`,
        sort: 'due_date',
      });
      return list.map(normalizeReminder);
    },
    async create(data: Partial<Reminder>): Promise<Reminder> {
      const record = await pb.collection('reminders').create({
        title: data.title || '', due_date: toISO(data.dueDate),
        end_time: toISO(data.endTime), description: data.description,
        recurring: data.recurring, assignee: data.assignee,
        labels: data.labels || [], flagged: data.flagged || false,
        is_private: data.isPrivate || false,
        linked_type: data.linkedType, linked_to: data.linkedTo,
        source: data.source || 'manual', dismissed: false,
        user: requireAuth().id,
      } as any);
      return normalizeReminder(record);
    },
    async update(id: string, data: Partial<Reminder>): Promise<Reminder> {
      const record = await pb.collection('reminders').update(id, {
        title: data.title, due_date: toISO(data.dueDate),
        end_time: toISO(data.endTime), description: data.description,
        recurring: data.recurring, assignee: data.assignee,
        labels: data.labels, flagged: data.flagged,
        is_private: data.isPrivate,
        linked_type: data.linkedType, linked_to: data.linkedTo,
        source: data.source, dismissed: data.dismissed,
        dismissed_at: toISO(data.dismissedAt),
      } as any);
      return normalizeReminder(record);
    },
    async dismiss(id: string): Promise<Reminder> {
      return this.update(id, { dismissed: true, dismissedAt: Date.now() });
    },
    async delete(id: string) { await pb.collection('reminders').delete(id); },
  },
};

export type ApiClient = typeof api;
