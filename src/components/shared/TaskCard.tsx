import type { Task } from '../../types';
import { CompactTaskCard } from './CompactTaskCard';

export interface TaskCardProps {
  task: Task;
  showCheckbox?: boolean;
  compact?: boolean;
  urgent?: boolean;
  calendarBlock?: boolean;
  startExpanded?: boolean;
  className?: string;
}

export function TaskCard(props: TaskCardProps) {
  return (
    <CompactTaskCard
      task={props.task}
      showCheckbox={props.showCheckbox}
      compact={props.compact}
      urgent={props.urgent}
      calendarBlock={props.calendarBlock}
      startExpanded={props.startExpanded}
      className={props.className}
    />
  );
}
