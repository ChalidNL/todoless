import { ChevronsUp, Minus, ChevronDown } from 'lucide-react';
import type { Priority } from '../types';
import { PRIORITY_COLORS } from './priority';

/** Unique icon per priority level — no text chip needed */
export function PriorityIcon({ priority, size = 14 }: { priority: Priority; size?: number }) {
  const color = PRIORITY_COLORS[priority] || '#6b7280';
  const props = { size, strokeWidth: 2.5, color, style: { flexShrink: 0 } as React.CSSProperties };
  switch (priority) {
    case 'high':   return <ChevronsUp {...props} />;
    case 'medium': return <Minus {...props} />;
    case 'low':    return <ChevronDown {...props} />;
    default:       return null;
  }
}
