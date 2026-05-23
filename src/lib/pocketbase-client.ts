import { pb } from './pocketbase';
import type {
  AppSettings,
  CalendarEvent,
  InviteCode,
  Item,
  Label,
  Note,
  Project,
  Reminder,
  Shop,
  Sprint,
  Task,
  User,
  Reward,
  Goal,
} from '../types';

const toTimestamp = (value?: string | null) => (value ? new Date(value).getTime() : undefined);

const normalizeUser = (record: any): User => ({
  id: record.id,
  email: record.email,
  name: record.name || record.email,
  firstName: record.first_name || undefined,
  lastName: record.last_name || undefined,
  displayName: record.display_name || undefined,
  avatarUrl: record.avatar,
  role: (record.role || 'member') as User['role'],
  family_id: record.family_id || undefined,
  active: typeof record.active === 'boolean' ? record.active : true,
});

const normalizeTask = (record: any): Task => ({
  id: record.id,
  title: record.title,
  status: record.status || 'todo',
  blocked: !!record.blocked,
  blockedComment: record.blocked_comment || undefined,
  priority: record.priority || undefined,
  horizon: record.horizon || undefined,
  assignedTo: record.assigned_to || undefined,
  sprintId: record.sprint_id || undefined,
  projectId: record.project_id || undefined,
  dueDate: toTimestamp(record.due_date),
  repeatInterval: record.repeat_interval || undefined,
  completedAt: toTimestamp(record.completed_at),
  archived: !!record.archived,
  archivedAt: toTimestamp(record.archived_at),
  deleteAfter: toTimestamp(record.delete_after),
  isPrivate: !!record.is_private,
  labels: Array.isArray(record.labels) ? record.labels : [],
  linkedItemIds: Array.isArray(record.linked_item_ids) ? record.linked_item_ids : [],
  linkedNoteIds: Array.isArray(record.linked_note_ids) ? record.linked_note_ids : [],
  subtaskIds: Array.isArray(record.subtask_ids) ? record.subtask_ids : [],
  linkedTo: record.linked_to || undefined,
  linkedType: record.linked_type || undefined,
  flag: !!record.flag,
  createdAt: toTimestamp(record.created) || Date.now(),
  createdBy: record.user,
});

const normalizeItem = (record: any): Item => ({
  id: record.id,
  title: record.title,
  completed: !!record.completed,
  shopId: record.shop_id || undefined,
  quantity: record.quantity || undefined,
  priority: record.priority || undefined,
  assignedTo: record.assigned_to || undefined,
  dueDate: toTimestamp(record.due_date),
  labels: Array.isArray(record.labels) ? record.labels : [],
  linkedTaskIds: Array.isArray(record.linked_task_ids) ? record.linked_task_ids : [],
  linkedNoteIds: Array.isArray(record.linked_note_ids) ? record.linked_note_ids : [],
  createdAt: toTimestamp(record.created) || Date.now(),
  createdBy: record.user,
  isPrivate: !!record.is_private,
});

const normalizeNote = (record: any): Note => ({
  id: record.id,
  title: record.title || undefined,
  content: record.content || '',
  pinned: !!record.pinned,
  linkedType: record.linked_type || undefined,
  linkedTo: record.linked_to || undefined,
  linkedIds: Array.isArray(record.linked_ids) ? record.linked_ids : [],
  linkedTaskIds: Array.isArray(record.linked_task_ids) ? record.linked_task_ids : [],
  linkedItemIds: Array.isArray(record.linked_item_ids) ? record.linked_item_ids : [],
  projectId: record.project_id || undefined,
  labels: Array.isArray(record.labels) ? record.labels : [],
  assignedTo: record.assigned_to || undefined,
  dueDate: toTimestamp(record.due_date),
  repeatInterval: record.repeat_interval || undefined,
  isPrivate: !!record.is_private,
  createdAt: toTimestamp(record.created) || Date.now(),
  createdBy: record.user,
});

const normalizeLabel = (record: any): Label => ({
  id: record.id,
  name: record.name,
  color: record.color,
  isPrivate: !!record.is_private,
  createdBy: record.user,
});

const normalizeShop = (record: any): Shop => ({
  id: record.id,
  name: record.name,
  color: record.color,
});

const normalizeSprint = (record: any): Sprint => ({
  id: record.id,
  name: record.name,
  startDate: toTimestamp(record.start_date) || Date.now(),
  endDate: toTimestamp(record.end_date) || Date.now(),
  duration: record.duration || '2weeks',
  weekNumber: record.week_number || 1,
  year: record.year || new Date().getFullYear(),
  status: record.status || 'planned',
  goal: record.goal ?? undefined,
  createdBy: record.user,
});

const normalizeCalendarEvent = (record: any): CalendarEvent => ({
  id: record.id,
  title: record.title,
  description: record.description || undefined,
  startTime: toTimestamp(record.start_time) || Date.now(),
  endTime: toTimestamp(record.end_time) || Date.now(),
  allDay: !!record.all_day,
  taskId: record.task_id || undefined,
  createdAt: toTimestamp(record.created) || Date.now(),
  createdBy: record.user,
});

const normalizeInvite = (record: any): InviteCode => ({
  id: record.id,
  code: record.code,
  createdBy: record.user,
  createdAt: toTimestamp(record.created),
  expiresAt: toTimestamp(record.expires_at),
  used: !!record.used,
  usedBy: record.used_by || undefined,
  usedAt: toTimestamp(record.used_at),
});

const normalizeSettings = (record: any): AppSettings => ({
  hasCompletedOnboarding: true,
  setupComplete: !!record.setup_complete,
  sprintDuration: record.sprint_duration || '2weeks',
  sprintStartDay: record.sprint_start_day ?? 1,
  currentUserId: record.user,
  language: record.language || 'en',
  archiveRetention: record.archive_retention_days ?? 30,
  autoCleanup: record.auto_cleanup ?? true,
  theme: record.theme || 'light',
  notificationEmail: record.notification_email ?? false,
  notificationPush: record.notification_push ?? false,
  taskReminders: record.task_reminders ?? true,
  reminderMinutes: record.reminder_minutes ?? 15,
});

const normalizeReward = (record: any): Reward => ({
  id: record.id,
  title: record.title,
  points: record.points || 0,
  earnedBy: record.earned_by,
  earnedAt: toTimestamp(record.earned_at),
  reason: record.reason || undefined,
  taskId: record.task_id || undefined,
  awardedBy: record.awarded_by || undefined,
});

const normalizeGoal = (record: any): Goal => ({
  id: record.id,
  title: record.title,
  description: record.description || undefined,
  pointsRequired: record.points_required || 0,
  pointsCurrent: record.points_current || 0,
  targetUser: record.target_user,
  completed: !!record.completed,
  completedAt: toTimestamp(record.completed_at),
  createdBy: record.user,
});

const normalizeProject = (record: any): Project => ({
  id: record.id,
  title: record.title,
  description: record.description || undefined,
  color: record.color || '#6366f1',
  status: record.status || 'active',
  taskIds: Array.isArray(record.task_ids) ? record.task_ids : [],
  dueDate: toTimestamp(record.due_date),
  createdAt: toTimestamp(record.created) || Date.now(),
  createdBy: record.user,
});

const normalizeReminder = (record: any): Reminder => ({
  id: record.id,
  title: record.title,
  description: record.description || undefined,
  dueDate: toTimestamp(record.due_date) || Date.now(),
  endTime: toTimestamp(record.end_time),
  recurring: record.recurring || undefined,
  assignee: record.assignee || undefined,
  labels: Array.isArray(record.labels) ? record.labels : [],
  flagged: !!record.flagged,
  isPrivate: !!record.is_private,
  linkedType: record.linked_type || undefined,
  linkedTo: record.linked_to || undefined,
  source: (record.source || 'manual') as Reminder['source'],
  dismissed: !!record.dismissed,
  dismissedAt: toTimestamp(record.dismissed_at),
  createdAt: toTimestamp(record.created) || Date.now(),
  createdBy: record.user,
});

class PocketBaseClient {
  private settingsRequest: Promise<AppSettings> | null = null;

  private showError(message: string) {
    // Create a toast notification for API errors
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#dc2626;color:white;padding:12px 24px;border-radius:8px;z-index:9999;font-size:14px;max-width:90vw;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  async validateInviteCode(inviteCode: string): Promise<{ id: string; code: string; status: string; message: string }> {
    const normalizedCode = inviteCode.trim().toUpperCase();
    const response = await fetch(`/api/todoless/validate-invite?code=${encodeURIComponent(normalizedCode)}`);

    if (!response.ok) {
      throw new Error('Failed to validate invite code');
    }

    const data = await response.json();
    if (data.status === 'valid') {
      return { id: data.invite.id, code: data.invite.code, status: 'valid', message: data.message };
    }
    throw new Error(data.message || `Invite code is ${data.status}`);
  }

  async login(email: string, password: string) {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return { token: pb.authStore.token, user: normalizeUser(authData.record) };
  }

  async registerAdmin(email: string, password: string, name: string, familyName?: string) {
    const firstName = name.trim().split(' ')[0];
    const lastName = name.trim().includes(' ') ? name.trim().substring(name.trim().indexOf(' ') + 1) : familyName || '';
    const response = await fetch('/api/todoless/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        passwordConfirm: password,
        firstName,
        lastName: lastName || familyName || '',
        name,
        family_name: familyName || 'My Family',
        user_type: 'family_member',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Admin registration failed');
    }

    // Authenticate via SDK so token is stored and authRefresh works
    await pb.collection('users').authWithPassword(email, password);

    return { token: pb.authStore.token, user: normalizeUser(pb.authStore.record) };
  }

  async register(email: string, password: string, name: string, inviteCode?: string, userType: string = 'family_member') {
    const firstName = name.trim().split(' ')[0];
    const lastName = name.trim().includes(' ') ? name.trim().substring(name.trim().indexOf(' ') + 1) : '';
    const body: Record<string, any> = {
      email,
      password,
      passwordConfirm: password,
      firstName,
      lastName,
      name,
      user_type: userType,
    };

    const normalizedInviteCode = inviteCode?.trim().toUpperCase();
    if (normalizedInviteCode) {
      body.invite_code = normalizedInviteCode;
    }

    const response = await fetch('/api/todoless/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    // Authenticate via SDK so token is stored and authRefresh works
    await pb.collection('users').authWithPassword(email, password);

    return { token: pb.authStore.token, user: normalizeUser(pb.authStore.record) };
  }

  async logout() {
    pb.authStore.clear();
  }

  async getCurrentUser() {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      throw new Error('Not authenticated');
    }
    return { user: normalizeUser(pb.authStore.record) };
  }

  async getTasks(): Promise<Task[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const familyId = (pb.authStore.record as any)?.family_id;
    const filter = familyId ? `user.family_id = "${familyId}"` : `user.id = "${userId}"`;
    const list = await pb.collection('tasks').getFullList({ filter, sort: '-created' });
    return list.map(normalizeTask);
  }

  async createTask(task: Partial<Task>) {
    try {
      const userId = pb.authStore.record?.id;
      return await pb.collection('tasks').create({
        title: task.title,
        status: task.status || 'todo',
        blocked: task.blocked || false,
        blocked_comment: task.blockedComment,
        priority: task.priority,
        horizon: task.horizon,
        assigned_to: task.assignedTo,
        sprint_id: task.sprintId,
        project_id: task.projectId,
        due_date: task.dueDate ? new Date(task.dueDate).toISOString() : null,
        repeat_interval: task.repeatInterval,
        labels: task.labels || [],
        is_private: task.isPrivate || false,
        archived: task.archived || false,
        archived_at: task.archivedAt ? new Date(task.archivedAt).toISOString() : null,
        delete_after: task.deleteAfter ? new Date(task.deleteAfter).toISOString() : null,
        completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
        subtask_ids: task.subtaskIds || [],
        linked_to: task.linkedTo,
        linked_type: task.linkedType,
        linked_item_ids: task.linkedItemIds || [],
        linked_note_ids: task.linkedNoteIds || [],
        flag: task.flag || false,
        user: userId,
      });
    } catch (error: any) {
      const msg = error?.response?.message || error?.message || 'Failed to create task';
      console.error('createTask failed:', error);
      this.showError(`Failed to add task: ${msg}`);
      throw error;
    }
  }

  // Create a subtask — PB SDK handles both child creation + parent subtask_ids update
  async createSubtask(title: string, parentId: string): Promise<{ id: string }> {
    const child = await this.createTask({
      title,
      status: 'todo',
      blocked: false,
      labels: [],
      linkedTo: parentId,
      linkedType: 'task',
      flag: false,
    } as any);
    // Update parent's subtask_ids via PB SDK (reliable — no fetch/routing issues)
    try {
      const parent = await pb.collection('tasks').getOne(parentId);
      const ids: string[] = (parent as any).subtask_ids || [];
      if (ids.indexOf(child.id) === -1) {
        ids.push(child.id);
        await pb.collection('tasks').update(parentId, { subtask_ids: ids });
      }
    } catch (err) {
      // Parent update failed — subtask created but won't show up linked
      // This shouldn't happen with valid auth
    }
    return { id: child.id };
  }

  async updateTask(id: string, updates: Partial<Task>) {
    try {
      const payload: Record<string, unknown> = {};
      const has = (key: keyof Task) => Object.prototype.hasOwnProperty.call(updates, key);

      for (const key of ['title', 'status', 'blocked', 'priority', 'horizon', 'labels', 'archived'] as const) {
        if (has(key)) payload[key] = updates[key];
      }

      if (has('blockedComment')) payload.blocked_comment = updates.blockedComment;
      if (has('sprintId')) payload.sprint_id = updates.sprintId;
      if (has('projectId')) payload.project_id = updates.projectId;
      if (has('assignedTo')) payload.assigned_to = updates.assignedTo;
      if (has('dueDate')) payload.due_date = updates.dueDate != null ? new Date(updates.dueDate).toISOString() : null;
      if (has('repeatInterval')) payload.repeat_interval = updates.repeatInterval;
      if (has('isPrivate')) payload.is_private = updates.isPrivate;
      if (has('archivedAt')) payload.archived_at = updates.archivedAt ? new Date(updates.archivedAt).toISOString() : undefined;
      if (has('deleteAfter')) payload.delete_after = updates.deleteAfter ? new Date(updates.deleteAfter).toISOString() : undefined;
      if (has('completedAt')) payload.completed_at = updates.completedAt ? new Date(updates.completedAt).toISOString() : undefined;
      if (has('linkedTo')) payload.linked_to = updates.linkedTo;
      if (has('linkedType')) payload.linked_type = updates.linkedType;
      if (has('linkedItemIds')) payload.linked_item_ids = updates.linkedItemIds;
      if (has('linkedNoteIds')) payload.linked_note_ids = updates.linkedNoteIds;
      if (has('subtaskIds')) payload.subtask_ids = updates.subtaskIds;
      if (has('flag')) payload.flag = updates.flag;

      return await pb.collection('tasks').update(id, payload);
    } catch (error: any) {
      const msg = error?.response?.message || error?.message || 'Failed to update task';
      console.error('updateTask failed:', error);
      this.showError(`Failed to update task: ${msg}`);
      throw error;
    }
  }

  async deleteTask(id: string) {
    await pb.collection('tasks').delete(id);
  }

  async getItems(): Promise<Item[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const familyId = (pb.authStore.record as any)?.family_id;
    const filter = familyId ? `user.family_id = "${familyId}"` : `user.id = "${userId}"`;
    const list = await pb.collection('items').getFullList({ filter, sort: '-created' });
    return list.map(normalizeItem);
  }

  async createItem(item: Partial<Item>) {
    try {
      return await pb.collection('items').create({
        title: item.title,
        completed: item.completed || false,
        shop_id: item.shopId,
        quantity: item.quantity,
        priority: item.priority,
        assigned_to: item.assignedTo,
        due_date: item.dueDate ? new Date(item.dueDate).toISOString() : null,
        labels: item.labels || [],
        is_private: item.isPrivate || false,
        linked_task_ids: item.linkedTaskIds || [],
        linked_note_ids: item.linkedNoteIds || [],
        user: pb.authStore.record?.id,
      });
    } catch (error: any) {
      const msg = error?.response?.message || error?.message || 'Failed to create item';
      console.error('createItem failed:', error);
      this.showError(`Failed to add item: ${msg}`);
      throw error;
    }
  }

  async updateItem(id: string, updates: Partial<Item>) {
    return pb.collection('items').update(id, {
      ...updates,
      shop_id: updates.shopId,
      assigned_to: updates.assignedTo,
      due_date: updates.dueDate ? new Date(updates.dueDate).toISOString() : undefined,
      linked_task_ids: updates.linkedTaskIds,
      linked_note_ids: updates.linkedNoteIds,
    });
  }

  async deleteItem(id: string) {
    await pb.collection('items').delete(id);
  }

  async getNotes(): Promise<Note[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('notes').getFullList({ filter: `user.id = "${userId}"`, sort: '-created' });
    return list.map(normalizeNote);
  }

  async createNote(note: Partial<Note>) {
    return pb.collection('notes').create({
      title: note.title,
      content: note.content,
      pinned: note.pinned || false,
      linked_type: note.linkedType,
      linked_to: note.linkedTo,
      linked_ids: note.linkedIds || [],
      linked_task_ids: note.linkedTaskIds || [],
      linked_item_ids: note.linkedItemIds || [],
      project_id: note.projectId,
      labels: note.labels || [],
      assigned_to: note.assignedTo,
      due_date: note.dueDate ? new Date(note.dueDate).toISOString() : null,
      repeat_interval: note.repeatInterval,
      is_private: note.isPrivate || false,
      user: pb.authStore.record?.id,
    });
  }

  async updateNote(id: string, updates: Partial<Note>) {
    return pb.collection('notes').update(id, {
      ...updates,
      linked_type: updates.linkedType,
      linked_to: updates.linkedTo,
      linked_ids: updates.linkedIds,
      linked_task_ids: updates.linkedTaskIds,
      linked_item_ids: updates.linkedItemIds,
      project_id: updates.projectId,
      assigned_to: updates.assignedTo,
      due_date: updates.dueDate ? new Date(updates.dueDate).toISOString() : undefined,
      repeat_interval: updates.repeatInterval,
      is_private: updates.isPrivate,
    });
  }

  async deleteNote(id: string) {
    await pb.collection('notes').delete(id);
  }

  async getLabels(): Promise<Label[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('labels').getFullList({ filter: `user.id = "${userId}"`, sort: 'name' });
    return list.map(normalizeLabel);
  }

  async createLabel(label: Partial<Label>) {
    return pb.collection('labels').create({
      name: label.name,
      color: label.color,
      is_private: label.isPrivate || false,
      user: pb.authStore.record?.id,
    });
  }

  async updateLabel(id: string, updates: Partial<Label>) {
    return pb.collection('labels').update(id, {
      name: updates.name,
      color: updates.color,
      is_private: updates.isPrivate,
    });
  }

  async deleteLabel(id: string) {
    await pb.collection('labels').delete(id);
  }

  async getShops(): Promise<Shop[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('shops').getFullList({ filter: `user.id = "${userId}"`, sort: 'name' });
    return list.map(normalizeShop);
  }

  async createShop(shop: Partial<Shop>) {
    return pb.collection('shops').create({ name: shop.name, color: shop.color, user: pb.authStore.record?.id });
  }

  async updateShop(id: string, updates: Partial<Shop>) {
    return pb.collection('shops').update(id, updates);
  }

  async deleteShop(id: string) {
    await pb.collection('shops').delete(id);
  }

  async getSprints(): Promise<Sprint[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('sprints').getFullList({ filter: `user.id = "${userId}"`, sort: '-start_date' });
    return list.map(normalizeSprint);
  }

  async createSprint(sprint: Partial<Sprint>) {
    return pb.collection('sprints').create({
      name: sprint.name,
      start_date: sprint.startDate ? new Date(sprint.startDate).toISOString() : null,
      end_date: sprint.endDate ? new Date(sprint.endDate).toISOString() : null,
      duration: sprint.duration,
      week_number: sprint.weekNumber,
      year: sprint.year,
      status: sprint.status || 'planned',
      goal: sprint.goal ?? null,
      user: pb.authStore.record?.id,
    });
  }

  async updateSprint(id: string, updates: Partial<Sprint>) {
    return pb.collection('sprints').update(id, {
      name: updates.name,
      start_date: updates.startDate ? new Date(updates.startDate).toISOString() : undefined,
      end_date: updates.endDate ? new Date(updates.endDate).toISOString() : undefined,
      duration: updates.duration,
      week_number: updates.weekNumber,
      year: updates.year,
      status: updates.status,
      goal: updates.goal ?? undefined,
    });
  }

  async deleteSprint(id: string) {
    await pb.collection('sprints').delete(id);
  }

  async getCalendarEvents(): Promise<CalendarEvent[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('calendar_events').getFullList({ filter: `user.id = "${userId}"`, sort: 'start_time' });
    return list.map(normalizeCalendarEvent);
  }

  async createCalendarEvent(event: Partial<CalendarEvent>) {
    return pb.collection('calendar_events').create({
      title: event.title,
      description: event.description,
      start_time: event.startTime ? new Date(event.startTime).toISOString() : null,
      end_time: event.endTime ? new Date(event.endTime).toISOString() : null,
      all_day: event.allDay || false,
      task_id: event.taskId,
      user: pb.authStore.record?.id,
    });
  }

  async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>) {
    return pb.collection('calendar_events').update(id, {
      ...updates,
      start_time: updates.startTime ? new Date(updates.startTime).toISOString() : undefined,
      end_time: updates.endTime ? new Date(updates.endTime).toISOString() : undefined,
      all_day: updates.allDay,
      task_id: updates.taskId,
    });
  }

  async deleteCalendarEvent(id: string) {
    await pb.collection('calendar_events').delete(id);
  }

  /** Check if the current authenticated user has an app_settings record (i.e. has seen onboarding). */
  async hasUserSeenOnboarding(): Promise<boolean> {
    if (!pb.authStore.isValid) return false;
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('app_settings').getFullList({ filter: `user = "${userId}"` });
    return list.length > 0;
  }

  /** Mark that the current user has completed onboarding. Creates app_settings record if needed. */
  async markOnboardingSeen(setupComplete = false) {
    if (!pb.authStore.isValid) return;
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('app_settings').getFullList({ filter: `user = "${userId}"` });
    if (list.length > 0) {
      await pb.collection('app_settings').update(list[0].id, { setup_complete: setupComplete });
    } else {
      await pb.collection('app_settings').create({
        user: userId,
        sprint_duration: '2weeks',
        sprint_start_day: 1,
        language: 'en',
        archive_retention_days: 30,
        auto_cleanup: true,
        theme: 'light',
        setup_complete: setupComplete,
      });
    }
  }

  async getSettings(): Promise<AppSettings> {
    if (!pb.authStore.isValid) {
      return {
        hasCompletedOnboarding: false,
        sprintDuration: '2weeks',
        sprintStartDay: 1,
        language: 'en',
        archiveRetention: 30,
        autoCleanup: true,
        theme: 'light',
      };
    }

    if (this.settingsRequest) return this.settingsRequest;

    const userId = pb.authStore.record?.id;

    this.settingsRequest = (async () => {
      const list = await pb.collection('app_settings').getFullList({ filter: `user = "${userId}"` });

      if (!list.length) {
        try {
          const created = await pb.collection('app_settings').create({
            user: userId,
            sprint_duration: '2weeks',
            sprint_start_day: 1,
            language: 'en',
            archive_retention_days: 30,
            auto_cleanup: true,
            theme: 'light',
          });
          return normalizeSettings(created);
        } catch {
          // Handle concurrent first-run create race (unique user index may already be filled).
          const retry = await pb.collection('app_settings').getFullList({ filter: `user = "${userId}"` });
          if (retry.length) return normalizeSettings(retry[0]);
          throw new Error('Failed to initialize settings');
        }
      }

      return normalizeSettings(list[0]);
    })();

    try {
      return await this.settingsRequest;
    } finally {
      this.settingsRequest = null;
    }
  }

  async updateSettings(updates: Partial<AppSettings>) {
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('app_settings').getFullList({ filter: `user = "${userId}"` });
    const payload: Record<string, unknown> = {
      sprint_duration: updates.sprintDuration,
      sprint_start_day: updates.sprintStartDay,
      language: updates.language,
      archive_retention_days: updates.archiveRetention,
      auto_cleanup: updates.autoCleanup,
      theme: updates.theme,
      briefing_enabled: updates.briefingEnabled,
    };
    if (updates.setupComplete !== undefined) {
      payload.setup_complete = updates.setupComplete;
    }

    if (list.length) {
      const updated = await pb.collection('app_settings').update(list[0].id, payload);
      return normalizeSettings(updated);
    }

    const created = await pb.collection('app_settings').create({ user: userId, ...payload });
    return normalizeSettings(created);
  }

  async getInvites(): Promise<InviteCode[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('invite_codes').getFullList({ filter: `user.id = "${userId}"`, sort: '-created' });
    return list.map(normalizeInvite);
  }

  async createInvite(data: { code: string; expiresAt: number; type?: string }) {
    const response = await fetch('/api/todoless/invites/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
      },
      body: JSON.stringify({ type: data.type || 'human' }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to create invite' }));
      throw new Error(err.error || 'Failed to create invite');
    }
    return response.json();
  }

  async deleteInvite(id: string) {
    await pb.collection('invite_codes').delete(id);
  }

  async getUsers(): Promise<User[]> {
    if (!pb.authStore.isValid) return [];
    const list = await pb.collection('users').getFullList({ sort: 'name' });
    return list.map(normalizeUser);
  }

  async updateUser(id: string, updates: any) {
    // Role changes must go through secured hook action (single-admin guardrails).
    if (typeof updates.role !== 'undefined') {
      const response = await fetch('/api/todoless/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
        },
        body: JSON.stringify({ action: 'set_role', user_id: id, role: updates.role }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to update role' }));
        throw new Error(err.error || 'Failed to update role');
      }
      return response.json();
    }

    // Active/block changes must go through secured hook action.
    if (typeof updates.active !== 'undefined') {
      const response = await fetch('/api/todoless/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
        },
        body: JSON.stringify({ action: 'set_user_block', user_id: id, blocked: !updates.active }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to update user status' }));
        throw new Error(err.error || 'Failed to update user status');
      }
      return response.json();
    }

    // Self profile/password updates still use SDK directly.
    return pb.collection('users').update(id, {
      name: updates.name,
      first_name: updates.firstName,
      last_name: updates.lastName,
      display_name: updates.displayName,
      password: updates.password,
      passwordConfirm: updates.password,
    });
  }

  async deleteUser(id: string) {
    const response = await fetch('/api/todoless/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
      },
      body: JSON.stringify({ action: 'delete_user', user_id: id }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to delete user' }));
      throw new Error(err.error || 'Failed to delete user');
    }

    return response.json();
  }

  // Rewards CRUD
  async getRewards(): Promise<Reward[]> {
    if (!pb.authStore.isValid) return [];
    const list = await pb.collection('rewards').getFullList({ sort: '-created' });
    return list.map(normalizeReward);
  }

  async createReward(reward: Partial<Reward>) {
    return pb.collection('rewards').create({
      title: reward.title,
      points: reward.points || 0,
      earned_by: reward.earnedBy,
      earned_at: reward.earnedAt ? new Date(reward.earnedAt).toISOString() : new Date().toISOString(),
      reason: reward.reason,
      task_id: reward.taskId,
      awarded_by: reward.awardedBy || pb.authStore.record?.id,
      user: pb.authStore.record?.id,
    });
  }

  async deleteReward(id: string) {
    await pb.collection('rewards').delete(id);
  }

  // Goals CRUD
  async getGoals(): Promise<Goal[]> {
    if (!pb.authStore.isValid) return [];
    const list = await pb.collection('goals').getFullList({ sort: '-created' });
    return list.map(normalizeGoal);
  }

  async createGoal(goal: Partial<Goal>) {
    return pb.collection('goals').create({
      title: goal.title,
      description: goal.description,
      points_required: goal.pointsRequired || 0,
      points_current: goal.pointsCurrent || 0,
      target_user: goal.targetUser,
      completed: false,
      user: pb.authStore.record?.id,
    });
  }

  async updateGoal(id: string, updates: Partial<Goal>) {
    return pb.collection('goals').update(id, {
      title: updates.title,
      description: updates.description,
      points_required: updates.pointsRequired,
      points_current: updates.pointsCurrent,
      target_user: updates.targetUser,
      completed: updates.completed,
      completed_at: updates.completedAt ? new Date(updates.completedAt).toISOString() : undefined,
    });
  }

  async deleteGoal(id: string) {
    await pb.collection('goals').delete(id);
  }

  // Projects CRUD
  async getProjects(): Promise<Project[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('projects').getFullList({ filter: `user.id = "${userId}"`, sort: '-created' });
    return list.map(normalizeProject);
  }

  async createProject(project: Partial<Project>) {
    try {
      return await pb.collection('projects').create({
        title: project.title,
        description: project.description,
        color: project.color || '#6366f1',
        status: project.status || 'active',
        task_ids: project.taskIds || [],
        due_date: project.dueDate ? new Date(project.dueDate).toISOString() : null,
        user: pb.authStore.record?.id,
      });
    } catch (error: any) {
      const msg = error?.response?.message || error?.message || 'Failed to create project';
      console.error('createProject failed:', error);
      this.showError(`Failed to create project: ${msg}`);
      throw error;
    }
  }

  async updateProject(id: string, updates: Partial<Project>) {
    return pb.collection('projects').update(id, {
      title: updates.title,
      description: updates.description,
      color: updates.color,
      status: updates.status,
      task_ids: updates.taskIds,
      due_date: updates.dueDate ? new Date(updates.dueDate).toISOString() : undefined,
    });
  }

  async deleteProject(id: string) {
    await pb.collection('projects').delete(id);
  }

  // Reminders CRUD
  async getReminders(): Promise<Reminder[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const list = await pb.collection('reminders').getFullList({ filter: `user.id = "${userId}"`, sort: 'due_date' });
    return list.map(normalizeReminder);
  }

  async createReminder(reminder: Partial<Reminder>) {
    try {
      return await pb.collection('reminders').create({
        title: reminder.title,
        description: reminder.description,
        due_date: reminder.dueDate ? new Date(reminder.dueDate).toISOString() : null,
        end_time: reminder.endTime ? new Date(reminder.endTime).toISOString() : null,
        recurring: reminder.recurring,
        assignee: reminder.assignee,
        labels: reminder.labels || [],
        flagged: reminder.flagged || false,
        is_private: reminder.isPrivate || false,
        linked_type: reminder.linkedType,
        linked_to: reminder.linkedTo,
        source: reminder.source || 'manual',
        dismissed: reminder.dismissed || false,
        dismissed_at: reminder.dismissedAt ? new Date(reminder.dismissedAt).toISOString() : null,
        user: pb.authStore.record?.id,
      });
    } catch (error: any) {
      const msg = error?.response?.message || error?.message || 'Failed to create reminder';
      console.error('createReminder failed:', error);
      this.showError(`Failed to add reminder: ${msg}`);
      throw error;
    }
  }

  async updateReminder(id: string, updates: Partial<Reminder>) {
    return pb.collection('reminders').update(id, {
      title: updates.title,
      description: updates.description,
      due_date: updates.dueDate ? new Date(updates.dueDate).toISOString() : undefined,
      end_time: updates.endTime ? new Date(updates.endTime).toISOString() : undefined,
      recurring: updates.recurring,
      assignee: updates.assignee,
      labels: updates.labels,
      flagged: updates.flagged,
      is_private: updates.isPrivate,
      linked_type: updates.linkedType,
      linked_to: updates.linkedTo,
      source: updates.source,
      dismissed: updates.dismissed,
      dismissed_at: updates.dismissedAt ? new Date(updates.dismissedAt).toISOString() : undefined,
    });
  }

  async deleteReminder(id: string) {
    await pb.collection('reminders').delete(id);
  }

  async dismissReminder(id: string) {
    return pb.collection('reminders').update(id, {
      dismissed: true,
      dismissed_at: new Date().toISOString(),
    });
  }

  // Shared views (multi-user)
  async getSharedTasks(): Promise<Task[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const familyId = (pb.authStore.record as any)?.family_id;
    const filter = familyId ? `is_private = false && user.family_id = "${familyId}"` : `is_private = false && user.id = "${userId}"`;
    const list = await pb.collection('tasks').getFullList({ filter, sort: '-created' });
    return list.map(normalizeTask);
  }

  async getSharedItems(): Promise<Item[]> {
    if (!pb.authStore.isValid) return [];
    const userId = pb.authStore.record?.id;
    const familyId = (pb.authStore.record as any)?.family_id;
    const filter = familyId ? `is_private = false && user.family_id = "${familyId}"` : `is_private = false && user.id = "${userId}"`;
    const list = await pb.collection('items').getFullList({ filter, sort: '-created' });
    return list.map(normalizeItem);
  }

  async getHouseholdUsers(): Promise<User[]> {
    if (!pb.authStore.isValid) return [];
    const list = await pb.collection('users').getFullList({ sort: 'name' });
    return list.map(normalizeUser);
  }

  // Family
  async createFamily(name: string, createdBy: string): Promise<{ id: string; name: string }> {
    const record = await pb.collection('families').create({ name, created_by: createdBy });
    return { id: record.id, name: record['name'] as string };
  }

  async getFamilyById(id: string): Promise<{ id: string; name: string }> {
    const record = await pb.collection('families').getOne(id);
    return { id: record.id, name: record['name'] as string };
  }

  async updateUserFamily(userId: string, familyId: string): Promise<void> {
    await pb.collection('users').update(userId, { family_id: familyId });
  }

  // ─── API Tokens ───────────────────────────────────────────────────────
  async getApiTokens(): Promise<any[]> {
    const response = await fetch('/api/todoless/api-tokens', {
      headers: { Authorization: `Bearer ${pb.authStore.token}` },
    });
    if (!response.ok) return [];
    return response.json();
  }

  async createApiToken(name: string, permissions: string[], expiresAt?: string): Promise<any> {
    const response = await fetch('/api/todoless/api-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pb.authStore.token}`,
      },
      body: JSON.stringify({ name, permissions, expires_at: expiresAt || null }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create token');
    return data;
  }

  async deleteApiToken(tokenId: string): Promise<void> {
    const response = await fetch(`/api/todoless/api-tokens/${tokenId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${pb.authStore.token}`,
      },
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete token');
    }
  }

  async toggleApiToken(tokenId: string, enabled: boolean): Promise<void> {
    const response = await fetch(`/api/todoless/api-tokens/${tokenId}/toggle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pb.authStore.token}`,
      },
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to toggle token');
    }
  }

  // ─── Daily Briefing ─────────────────────────────────────────────────────
  async getBriefing(): Promise<any> {
    const response = await fetch('/api/todoless/briefing', {
      headers: { Authorization: `Bearer ${pb.authStore.token}` },
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      const data = await response.json();
      throw new Error(data.error || 'Failed to fetch briefing');
    }
    return response.json();
  }

  async generateBriefing(): Promise<any> {
    const response = await fetch('/api/todoless/briefing/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pb.authStore.token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to generate briefing');
    return data;
  }
}

export const api = new PocketBaseClient();