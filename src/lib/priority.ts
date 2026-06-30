import type { Priority } from '../types';

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#ef4444',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const PRIORITY_ORDER: Priority[] = ['low', 'medium', 'high'];
