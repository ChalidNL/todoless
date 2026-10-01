export type TimeLeft = { unit: 'days' | 'hours' | 'minutes'; n: number };

// Largest whole unit of a remaining duration: invites live for 7 days, so
// "10079 minutes remaining" reads better as "6 days remaining".
export function timeLeft(ms: number): TimeLeft {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes >= 24 * 60) return { unit: 'days', n: Math.floor(minutes / (24 * 60)) };
  if (minutes >= 60) return { unit: 'hours', n: Math.floor(minutes / 60) };
  return { unit: 'minutes', n: minutes };
}

export const TIME_LEFT_KEYS: Record<TimeLeft['unit'], string> = {
  days: 'invite.daysRemaining',
  hours: 'invite.hoursRemaining',
  minutes: 'invite.minutesRemaining',
};
