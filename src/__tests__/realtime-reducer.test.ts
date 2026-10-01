import { describe, expect, it } from 'vitest';
import { applyRealtimeEvent, isVisibleToMe } from '../lib/realtime-reducer';

const a = { id: 'a', title: 'A' };
const b = { id: 'b', title: 'B' };

describe('applyRealtimeEvent (#77)', () => {
  it('inserts new records at the top, replaces updated ones in place, removes deleted ones', () => {
    expect(applyRealtimeEvent([a], 'create', b)).toEqual([b, a]);
    expect(applyRealtimeEvent([a, b], 'update', { id: 'a', title: 'A2' })).toEqual([{ id: 'a', title: 'A2' }, b]);
    expect(applyRealtimeEvent([a, b], 'delete', a)).toEqual([b]);
  });

  it('treats an update for an unknown record as an insert and is a no-op for unknown deletes', () => {
    expect(applyRealtimeEvent([a], 'update', b)).toEqual([b, a]);
    const list = [a];
    expect(applyRealtimeEvent(list, 'delete', b)).toBe(list);
  });

  it('drops records the caller does not show', () => {
    expect(applyRealtimeEvent([a, b], 'update', a, false)).toEqual([b]);
  });
});

describe('isVisibleToMe', () => {
  it('always shows own records, never other members\' private ones', () => {
    expect(isVisibleToMe({ createdBy: 'me', isPrivate: true }, 'me')).toBe(true);
    expect(isVisibleToMe({ createdBy: 'other', isPrivate: true }, 'me')).toBe(false);
    expect(isVisibleToMe({ createdBy: 'other', isPrivate: false }, 'me')).toBe(true);
  });
});
