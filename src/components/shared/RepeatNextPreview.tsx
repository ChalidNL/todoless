import { RepeatInterval } from '../../types';
import { t, formatDate } from '../../i18n/translations';
import { getNextRecurringDueDate } from '../../lib/repeat-schedule';

interface RepeatNextPreviewProps {
  repeatInterval?: RepeatInterval | null;
  dueDate?: number | null;
}

/**
 * GH#7 — "Next occurrence" hint shown in the schedule editor while a repeat
 * interval is selected. Uses the same date math (getNextRecurringDueDate) that
 * the server hook applies when the task is completed, so the preview and the
 * actual follow-up task agree on the date.
 */
export function RepeatNextPreview({ repeatInterval, dueDate }: RepeatNextPreviewProps) {
  if (!repeatInterval || !dueDate) return null;

  let nextIso: string;
  try {
    nextIso = getNextRecurringDueDate(repeatInterval, new Date(dueDate).toISOString());
  } catch {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-neutral-500" aria-label={t('tasks.nextOccurrenceAria')}>
      {t('tasks.nextOccurrence')}: {formatDate(nextIso, { month: 'short', day: 'numeric' })}
    </p>
  );
}