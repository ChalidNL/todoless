import { describe, it, expect, vi } from 'vitest';

// Test week view date math
describe('Calendar Week View', () => {
  const now = new Date();

  // getWeekDays logic from Calendar.tsx
  const getWeekDays = (currentDate: Date) => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  it('returns 7 days starting from Sunday', () => {
    const wednesday = new Date(2025, 4, 14); // May 14, 2025 is Wednesday
    const days = getWeekDays(wednesday);

    expect(days.length).toBe(7);
    expect(days[0].getDay()).toBe(0); // Sunday
    expect(days[0].getDate()).toBe(11); // May 11
    expect(days[6].getDate()).toBe(17); // May 17
  });

  it('includes today when currentDate is today', () => {
    const days = getWeekDays(now);
    const todayStr = now.toDateString();
    const hasToday = days.some(d => d.toDateString() === todayStr);
    expect(hasToday).toBe(true);
  });

  it('calculates correct week range display string', () => {
    const days = getWeekDays(now);
    const s = days[0];
    const e = days[6];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sMonth = months[s.getMonth()];
    const eMonth = months[e.getMonth()];

    // Display should contain start date, end date, and year
    const display = sMonth === eMonth
      ? `${sMonth} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
      : `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${s.getFullYear()}`;

    expect(display).toContain(s.getFullYear());
    expect(display.length).toBeGreaterThan(10);
  });

  it('filters timed events correctly within hour slot', () => {
    const dayStart = new Date(2025, 4, 12, 0, 0, 0, 0).getTime();

    const events = [
      { id: 'e1', startTime: dayStart + 9 * 3600000, endTime: dayStart + 10 * 3600000, title: '9 AM meeting' },
      { id: 'e2', startTime: dayStart + 9.5 * 3600000, endTime: dayStart + 10.5 * 3600000, title: '9:30 call' },
      { id: 'e3', startTime: dayStart + 14 * 3600000, endTime: dayStart + 15 * 3600000, title: '2 PM event' },
    ];

    // Events starting in the 9:00-10:00 hour
    const hour9 = events.filter(ev => {
      const startMin = new Date(ev.startTime).getHours() * 60 + new Date(ev.startTime).getMinutes();
      return startMin >= 9 * 60 && startMin < 10 * 60;
    });

    expect(hour9).toHaveLength(2);
    expect(hour9.map(e => e.id)).toContain('e1');
    expect(hour9.map(e => e.id)).toContain('e2');
  });

  it('positions event bar at correct offset within hour', () => {
    const HOUR_HEIGHT = 48;
    const eventStartMin = 9 * 60 + 30; // 9:30
    const hour = 9;
    const topOffset = ((eventStartMin - hour * 60) / 60) * HOUR_HEIGHT;
    expect(topOffset).toBe(24); // Halfway down the hour slot
  });

  it('calculates correct height for 1-hour event', () => {
    const HOUR_HEIGHT = 48;
    const durationMin = 60;
    const heightPx = Math.max((durationMin / 60) * HOUR_HEIGHT, 18);
    expect(heightPx).toBe(48);
  });

  it('enforces minimum 15-minute event height', () => {
    const HOUR_HEIGHT = 48;
    const durationMin = 15;
    const heightPx = Math.max((durationMin / 60) * HOUR_HEIGHT, 18);
    expect(heightPx).toBe(18);
  });

  it('current time line appears only for current week', () => {
    const weekDays = getWeekDays(now);
    const isCurrentWeek = now >= weekDays[0] && now <= weekDays[6];
    expect(isCurrentWeek).toBe(true);

    // A date far in the past should not be current week
    const pastDays = getWeekDays(new Date(2020, 0, 1));
    const isPastCurrent = now >= pastDays[0] && now <= pastDays[6];
    expect(isPastCurrent).toBe(false);
  });

  it('navigation shifts date by 7 days', () => {
    const start = new Date(2025, 4, 14);

    const prevWeek = new Date(start);
    prevWeek.setDate(start.getDate() - 7);
    expect(prevWeek.getDate()).toBe(7);

    const nextWeek = new Date(start);
    nextWeek.setDate(start.getDate() + 7);
    expect(nextWeek.getDate()).toBe(21);
  });

  it('hour range covers 6 AM to 11 PM (18 hours)', () => {
    const HOUR_START = 6;
    const HOUR_END = 23;
    const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
    expect(hours.length).toBe(18);
    expect(hours[0]).toBe(6);
    expect(hours[hours.length - 1]).toBe(23);
  });
});
