import type { Priority } from '../types';

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#ef4444',
};

export const PRIORITY_LABEL_KEYS: Record<Priority, string> = {
  low: 'tasks.priorityLow',
  medium: 'tasks.priorityMedium',
  high: 'tasks.priorityHigh',
};

export const PRIORITY_ORDER: Priority[] = ['low', 'medium', 'high'];
