export interface Family {
  id: string;
  name: string;
  created_by: string;
  created: string;
  updated: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  isPrivate?: boolean;
  createdBy?: string;
}

export interface Shop {
  id: string;
  name: string;
  color: string;
}

export type Priority = 'low' | 'medium' | 'high';
export type Horizon = 'week' | 'month' | '3months' | '6months' | 'year';
export type TaskStatus = 'backlog' | 'todo' | 'done';
export type SprintDuration = '1week' | '2weeks' | '3weeks' | '1month';
export type SprintStatus = 'planned' | 'active' | 'completed';
export type RepeatInterval = 'day' | 'week' | 'month' | 'year' | 'month_weekday';
export type ReminderRepeatInterval = 'hour' | 'day' | 'week' | 'month' | 'year';

export type UserRole = 'owner' | 'admin' | 'member' | 'agent';
export type MemberType = 'human' | 'agent';
export type MemberStatus = 'pending_approval' | 'active' | 'blocked';
export type UserLanguage = 'nl' | 'fr' | 'en';

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  role?: UserRole;
  member_type?: MemberType;
  member_status?: MemberStatus;
  language?: UserLanguage;
  family_id?: string;
  active?: boolean;
}

/** Get the display name for a user: first+last > display/full name > first name > email */
export function userDisplayName(
  user?: (Pick<User, 'firstName' | 'lastName' | 'displayName' | 'name' | 'email'> & { fullName?: string }) | null,
): string {
  if (!user) return '';

  const fullName = [user.firstName, user.lastName].filter((part): part is string => !!part).join(' ').trim();
  return fullName || user.displayName || user.fullName || user.name || user.firstName || user.email?.split('@')[0] || '';
}

export interface InviteCode {
  id: string;
  code: string;
  createdBy?: string;
  createdAt?: number;
  expiresAt?: number;
  used?: boolean;
  usedBy?: string;
  usedAt?: number;
  type?: 'human';
  token?: string;
}

export type ItemLinkedType = 'task' | 'item';

export interface Item {
  id: string;
  title: string;
  completed: boolean;
  focus?: boolean;
  shopId?: string;
  quantity?: number;
  priority?: Priority;
  assignedTo?: string;
  dueDate?: number;
  labels: string[];
  linkedTaskIds?: string[];
  linkedNoteIds?: string[];
  createdAt: number;
  createdBy?: string;
  isPrivate?: boolean;
  category?: string;
  location?: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  blocked: boolean;
  blockedComment?: string;
  focus?: boolean;
  priority?: Priority;
  horizon?: Horizon;
  assignedTo?: string;
  sprintId?: string;
  projectId?: string;
  dueDate?: number;
  startTime?: number;
  endTime?: number;
  allDay?: boolean;
  showInCalendar?: boolean;
  repeatInterval?: RepeatInterval;
  completedAt?: number;
  completedBy?: string;
  archived?: boolean;
  archivedAt?: number;
  deleteAfter?: number;
  isPrivate?: boolean;
  labels: string[];
  linkedItemIds?: string[];
  linkedNoteIds?: string[];
  subtaskIds?: string[];
  // Reminders module fields
  linkedTo?: string;              // ~linked — ID of linked entity
  linkedType?: 'task' | 'item' | 'note'; // ~linked — type of linked entity
  flag: boolean;                  // flag — visual reminder marker
  createdAt: number;
  createdBy?: string;
}

export interface Note {
  id: string;
  title?: string;
  content: string;
  pinned?: boolean;
  linkedType?: 'task' | 'item' | 'note';
  linkedTo?: string;
  linkedIds?: string[];
  linkedTaskIds?: string[];
  linkedItemIds?: string[];
  projectId?: string;
  labels: string[];
  assignedTo?: string;
  dueDate?: number;
  repeatInterval?: RepeatInterval;
  isPrivate?: boolean;
  createdAt: number;
  createdBy?: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: number;
  endDate: number;
  duration: SprintDuration;
  weekNumber: number;
  year: number;
  status: SprintStatus;
  goal?: number;
  createdBy?: string;
}

export interface CalendarEvent {
  id: string;
  uid?: string;
  title: string;
  description?: string;
  location?: string;
  startTime: number;
  endTime: number;
  allDay?: boolean;
  timezone?: string;
  rrule?: string;
  exdates?: string[];
  recurrenceId?: string;
  color?: string;
  attendees?: Array<{ id?: string; email?: string; name?: string; rsvp?: 'yes' | 'no' | 'maybe' | 'pending' }>;
  source?: 'local' | 'ics_import' | 'caldav';
  externalId?: string;
  taskId?: string;
  reminders?: number[];
  createdAt: number;
  createdBy?: string;
}

export interface Filter {
  id: string;
  name: string;
  labelIds: string[];
  chipFilters?: {type: string; id: string; label?: string; color?: string}[];
  showCompleted: boolean;
  type: 'task' | 'item' | 'both';
  query?: string;
}

export interface AppSettings {
  hasCompletedOnboarding?: boolean;
  setupComplete?: boolean;
  sprintDuration?: SprintDuration;
  sprintStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
  currentUserId?: string;
  language?: string;
  archiveRetention?: number;
  autoCleanup?: boolean;
  theme?: 'light' | 'dark';
  notificationEmail?: boolean;
  notificationPush?: boolean;
  taskReminders?: boolean;
  reminderMinutes?: number;
  briefingEnabled?: boolean;
}

export interface ProgressStats {
  tasksCompletedThisWeek: number;
  lastWeekReset: number;
}

export interface Reward {
  id: string;
  title: string;
  points: number;
  earnedBy: string;
  earnedAt?: number;
  reason?: string;
  taskId?: string;
  awardedBy?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  pointsRequired: number;
  pointsCurrent: number;
  targetUser: string;
  completed: boolean;
  completedAt?: number;
  createdBy: string;
}

export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  title: string;
  description?: string;
  color: string;
  status: ProjectStatus;
  taskIds: string[];
  dueDate?: number;
  createdAt: number;
  createdBy?: string;
}

export type ReminderSource = 'task' | 'item' | 'manual';

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueDate: number;
  endTime?: number;
  recurring?: RepeatInterval;
  assignee?: string;
  labels: string[];
  flagged: boolean;
  isPrivate: boolean;
  linkedType?: 'task' | 'item';
  linkedTo?: string;
  source: ReminderSource;
  dismissed: boolean;
  dismissedAt?: number;
  fired?: boolean;
  createdAt: number;
  createdBy?: string;
}

// Unified Entry model combining Task and Item
export interface Entry {
  id: string;
  title: string;
  type: 'task' | 'item';
  status?: TaskStatus;
  completed?: boolean;
  blocked?: boolean;
  blockedComment?: string;
  focus?: boolean;
  priority?: Priority;
  horizon?: Horizon;
  assignedTo?: string;
  sprintId?: string;
  dueDate?: number;
  repeatInterval?: RepeatInterval;
  completedAt?: number;
  archived?: boolean;
  archivedAt?: number;
  deleteAfter?: number;
  isPrivate?: boolean;
  labels: string[];
  linkedItemIds?: string[];
  linkedNoteIds?: string[];
  subtaskIds?: string[];
  linkedTo?: string;
  linkedType?: 'task' | 'item' | 'note';
  flag?: boolean;
  createdAt: number;
  createdBy?: string;
  // Item-specific fields
  shopId?: string;
  quantity?: number;
  category?: string;
  location?: string;
}

export interface ApiToken {
  id: string;
  name: string;
  permissions: string[];
  expires_at?: string;
  enabled: boolean;
  user: string;
  created: string;
  token?: string; // Only present on creation response
}

export type AgentStatus = 'pending' | 'approved' | 'rejected';

export interface Agent {
  id: string;
  name: string;
  email: string;
  status: AgentStatus;
  token?: string; // Only present on approval response
  created: string;
  updated?: string;
}

export type NotificationInboxKind = 'custom' | 'reminder' | 'system';
export type NotificationInboxChannel = 'inbox' | 'push' | 'email';

export interface NotificationInboxItem {
  id: string;
  title: string;
  kind: NotificationInboxKind;
  channel: NotificationInboxChannel;
  read: boolean;
  archived: boolean;
  createdAt: number;
}
