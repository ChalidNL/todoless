/**
 * ICS (.ics) file parser using ical.js.
 * Extracts VEVENT components and maps them to a flat intermediate format
 * suitable for sending to the PB import endpoint.
 */
import ICAL from 'ical.js';
import { t } from '../i18n/translations';

function message(key: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [name, value]) => text.split(`{${name}}`).join(value), t(key));
}

// An all-day DTSTART/DTEND (VALUE=DATE) as the app's date-only value: UTC
// midnight of that calendar date, independent of the browser's timezone.
function dateOnlyIso(time: ICAL.Time): string {
  return new Date(Date.UTC(time.year, time.month - 1, time.day)).toISOString();
}

export interface ParsedEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start_time: string;   // ISO 8601
  end_time: string;     // ISO 8601
  all_day: boolean;
  timezone?: string;
  rrule?: string;
  exdates?: string[];
  recurrence_id?: string;
  // Optional: event-level labels (merged with bulk labels later)
  labels?: string[];
}

export interface ParseResult {
  events: ParsedEvent[];
  errors: string[];
  dateRange: { start: string; end: string } | null;
}

/**
 * Parse an .ics string and return extracted VEVENTs.
 */
export function parseIcs(icsText: string): ParseResult {
  const events: ParsedEvent[] = [];
  const errors: string[] = [];
  let minDate: string | null = null;
  let maxDate: string | null = null;

  try {
    const jcalData = ICAL.parse(icsText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent);

        if (!event.startDate) {
          errors.push(message('ics.eventWithoutStart', { title: event.summary || t('common.untitled') }));
          continue;
        }

        // All-day is what the file says (DTSTART;VALUE=DATE), not a guess
        // from the clock: a timed event at exactly 00:00 stays timed (#257).
        const allDay = event.startDate.isDate;
        const startISO = allDay ? dateOnlyIso(event.startDate) : event.startDate.toJSDate().toISOString();
        const endISO = event.endDate
          ? (allDay && event.endDate.isDate ? dateOnlyIso(event.endDate) : event.endDate.toJSDate().toISOString())
          : startISO;

        // Track date range
        if (!minDate || startISO < minDate) minDate = startISO;
        if (!maxDate || endISO > maxDate) maxDate = endISO;

        // Extract recurrence info
        const rruleProp = event.component?.getFirstPropertyValue('rrule');
        const rruleStr = rruleProp && typeof rruleProp !== 'string'
          ? String((rruleProp as any)?.toString?.() ?? rruleProp)
          : (typeof rruleProp === 'string' ? rruleProp : undefined);

        // Extract EXDATEs
        const exdateProps = event.component?.getAllProperties('exdate') || [];
        const exdates: string[] = [];
        for (const prop of exdateProps) {
          const vals = prop.getValues();
          for (const val of vals) {
            if (val instanceof Date) {
              exdates.push(val.toISOString());
            } else if (typeof val === 'string') {
              exdates.push(val);
            }
          }
        }

        // Recurrence ID
        const recIdRaw = event.component?.getFirstPropertyValue('recurrence-id');
        const recIdStr = recIdRaw
          ? (
              recIdRaw instanceof Date
                ? recIdRaw.toISOString()
                : typeof recIdRaw === 'string'
                  ? recIdRaw
                  : String(recIdRaw)
            )
          : undefined;

        events.push({
          uid: event.uid || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          title: event.summary || t('common.untitled'),
          description: typeof event.description === 'string' ? event.description : (event.description ? String(event.description) : undefined),
          location: typeof event.location === 'string' ? event.location : (event.location ? String(event.location) : undefined),
          start_time: startISO,
          end_time: endISO,
          all_day: allDay,
          timezone: (() => { const tz = event.component?.getFirstPropertyValue('tzid'); return typeof tz === 'string' ? tz : undefined; })(),
          rrule: rruleStr,
          exdates: exdates.length > 0 ? exdates : undefined,
          recurrence_id: recIdStr,
        });
      } catch (e: any) {
        errors.push(message('ics.eventUnreadable', { error: e?.message || String(e) }));
      }
    }
  } catch (e: any) {
    errors.push(message('ics.fileUnreadable', { error: e?.message || String(e) }));
  }

  return {
    events,
    errors,
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
  };
}

/**
 * Extract .ics files from a Google Calendar export .zip.
 * Returns an array of { filename, content } objects.
 */
export async function extractIcsFromZip(
  zipFile: File,
): Promise<{ filename: string; content: string }[]> {
  // Dynamic import of JSZip to avoid bundling for non-zip users
  const JSZipModule = await import('jszip');
  const JSZip = (JSZipModule as any).default || JSZipModule;
  const zip = await JSZip.loadAsync(zipFile);
  const files: { filename: string; content: string }[] = [];

  for (const [filename, file] of Object.entries(zip.files)) {
    const zipEntry = file as any;
    if (zipEntry.dir) continue;
    if (filename.toLowerCase().endsWith('.ics')) {
      const content = await zipEntry.async('string');
      files.push({ filename, content });
    }
  }

  return files;
}

/** Read a File as text (for direct .ics uploads) */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
