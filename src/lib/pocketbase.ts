import PocketBase from 'pocketbase';

const resolvePocketBaseUrl = () => {
  const configuredUrl =
    import.meta.env.VITE_POCKETBASE_URL ||
    (window as any).ENV_POCKETBASE_URL ||
    '';

  if (typeof window !== 'undefined') {
    if (!configuredUrl) {
      return window.location.origin;
    }

    if (/^https?:\/\/pocketbase(?::\d+)?$/i.test(configuredUrl) || /^pocketbase(?::\d+)?$/i.test(configuredUrl)) {
      return window.location.origin;
    }

    return configuredUrl;
  }

  return configuredUrl || 'http://localhost:8090';
};

const pbUrl = resolvePocketBaseUrl();

// Create a single PocketBase client instance
export const pb = new PocketBase(pbUrl);

// Enable auto cancellation for duplicate requests
pb.autoCancellation(false);

// Database types (TypeScript interfaces)
export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  role: 'owner' | 'admin' | 'member' | 'agent';
  avatar?: string;
  created: string;
  updated: string;
}

export interface Task {
  id: string;
  title: string;
  status: 'backlog' | 'todo' | 'done';
  priority?: 'urgent' | 'normal' | 'low';
  horizon?: 'week' | 'month' | '3months' | '6months' | 'year';
  blocked: boolean;
  blocked_comment?: string;
  sprint_id?: string;
  assigned_to?: string;
  due_date?: string;
  repeat_interval?: 'week' | 'month' | 'year';
  labels: string[];
  subtask_ids?: string[];
  is_private: boolean;
  archived: boolean;
  archived_at?: string;
  delete_after?: string;
  completed_at?: string;
  // Reminders module fields
  linked_to?: string;          // ~linked — ID of linked task
  linked_type?: 'task' | 'item' | 'note'; // ~linked — type of linked entity
  flag: boolean;               // flag — visual reminder marker
  user: string;                // User ID relation
  created: string;
  updated: string;
}

export interface Item {
  id: string;
  title: string;
  quantity?: number;
  category?: string;
  location?: string;
  minimum_stock?: number;
  completed: boolean;
  labels: string[];
  shop_id?: string;
  is_private: boolean;
  // Groceries module — linked relation fields
  linked_type?: 'task' | 'item';
  linked_to?: string;
  user: string; // User ID relation
  created: string;
  updated: string;
}

export interface Note {
  id: string;
  content: string;
  linked_to?: string;
  linked_type?: 'task' | 'item';
  labels: string[];
  pinned: boolean;
  is_private: boolean;
  user: string; // User ID relation
  created: string;
  updated: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  is_private: boolean;
  created_by: string; // User ID relation
  created: string;
}

export interface Shop {
  id: string;
  name: string;
  color: string;
  user: string; // User ID relation
  created: string;
}

export interface Sprint {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  duration: '1week' | '2weeks' | '3weeks' | '1month';
  week_number?: number;
  year?: number;
  user: string; // User ID relation
  created: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date?: string;
  assigned_to?: string;
  priority?: 'urgent' | 'normal' | 'low';
  horizon?: 'week' | 'month' | '3months' | '6months' | 'year';
  blocked: boolean;
  blocked_comment?: string;
  due_date?: string;
  repeat_interval?: 'week' | 'month' | 'year';
  labels: string[];
  is_private: boolean;
  user: string; // User ID relation
  created: string;
  updated: string;
}

export interface InviteCode {
  id: string;
  code: string;
  created_by: string; // User ID relation
  expires_at: string;
  used: boolean;
  used_by?: string;
  used_at?: string;
  created: string;
}

export interface AppSettings {
  id: string;
  user: string;
  theme: string;
  language: string;
  archive_retention_days?: number;
  auto_cleanup: boolean;
  preferences: any;
  created: string;
  updated: string;
}

export interface Reward {
  id: string;
  title: string;
  points: number;
  earned_by: string;
  earned_at?: string;
  reason?: string;
  task_id?: string;
  awarded_by?: string;
  user: string;
  created: string;
  updated: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  points_required: number;
  points_current: number;
  target_user: string;
  completed: boolean;
  completed_at?: string;
  user: string;
  created: string;
  updated: string;
}
