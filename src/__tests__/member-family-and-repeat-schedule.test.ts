import { describe, expect, it } from 'vitest';
import { buildFamilyMembershipView } from '../lib/member-family-utils';
import { getNextRecurringDueDate, getRepeatDescriptor } from '../lib/repeat-schedule';

describe('member family utils', () => {
  it('filters to the current family and sorts owner/admin/member', () => {
    const view = buildFamilyMembershipView(
      [
        { id: 'm1', name: 'Member One', email: 'm1@example.com', role: 'member', family_id: 'fam-a' },
        { id: 'a1', name: 'Admin One', email: 'a1@example.com', role: 'admin', family_id: 'fam-a' },
        { id: 'o1', name: 'Owner One', email: 'o1@example.com', role: 'owner', family_id: 'fam-a' },
        { id: 'x1', name: 'Other Family', email: 'x1@example.com', role: 'member', family_id: 'fam-b' },
      ],
      'fam-a',
      'Gezin Chalid'
    );

    expect(view.familyId).toBe('fam-a');
    expect(view.familyName).toBe('Gezin Chalid');
    expect(view.members.map((member) => member.id)).toEqual(['o1', 'a1', 'm1']);
  });

  it('falls back to users without family when no current family id exists', () => {
    const view = buildFamilyMembershipView(
      [
        { id: 'a1', name: 'Admin One', email: 'a1@example.com', role: 'admin' },
        { id: 'm1', name: 'Member One', email: 'm1@example.com', role: 'member' },
        { id: 'f1', name: 'Family User', email: 'f1@example.com', role: 'member', family_id: 'fam-a' },
      ],
      undefined,
      undefined
    );

    expect(view.members.map((member) => member.id)).toEqual(['a1', 'm1']);
    expect(view.familyName).toBe('No family assigned');
  });
});

describe('repeat schedule', () => {
  it('describes a due date as the correct monthly weekday pattern', () => {
    const descriptor = getRepeatDescriptor('month_weekday', new Date('2026-06-08T09:00:00Z').getTime(), 'en');
    expect(descriptor).toBe('Every second Monday of the month');
  });

  it('calculates the next monthly weekday recurrence from the due date pattern', () => {
    const nextDueDate = getNextRecurringDueDate('month_weekday', new Date('2026-06-08T09:00:00Z').toISOString());
    expect(nextDueDate).toBe('2026-07-13T09:00:00.000Z');
  });

  it('keeps plain monthly recurrence on the same calendar day when possible', () => {
    const nextDueDate = getNextRecurringDueDate('month', new Date('2026-01-15T09:00:00Z').toISOString());
    expect(nextDueDate).toBe('2026-02-15T09:00:00.000Z');
  });
});
