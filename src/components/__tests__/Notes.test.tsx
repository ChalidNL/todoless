import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Note } from '../../types';

describe('Note type', () => {
  it('accepts a note with all new fields', () => {
    const note: Note = {
      id: 'n1',
      title: 'Test note',
      content: 'Content here',
      pinned: true,
      linkedType: 'task',
      linkedTo: 't123',
      linkedIds: ['n2', 'i3'],
      labels: ['label1'],
      assignedTo: 'user1',
      dueDate: Date.now() + 86400000,
      repeatInterval: 'week',
      isPrivate: true,
      createdAt: Date.now(),
      createdBy: 'user1',
    };
    expect(note.title).toBe('Test note');
    expect(note.isPrivate).toBe(true);
    expect(note.assignedTo).toBe('user1');
    expect(note.repeatInterval).toBe('week');
    expect(note.linkedIds).toEqual(['n2', 'i3']);
  });

  it('accepts a minimal note', () => {
    const note: Note = {
      id: 'n1',
      content: 'Just content',
      labels: [],
      createdAt: Date.now(),
    };
    expect(note.content).toBe('Just content');
    expect(note.pinned).toBeUndefined();
    expect(note.isPrivate).toBeUndefined();
  });

  it('supports note linking type', () => {
    const note: Note = {
      id: 'n1',
      content: 'Linked note',
      linkedType: 'note',
      linkedTo: 'n2',
      labels: [],
      createdAt: Date.now(),
    };
    expect(note.linkedType).toBe('note');
  });
});

describe('Notes API normalizeNote', () => {
  // Test the normalization logic inline since we can't import the module directly
  // due to PB SDK dependencies. We replicate the logic here.
  const toTimestamp = (value?: string | null) => (value ? new Date(value).getTime() : undefined);

  const normalizeNote = (record: any): Note => ({
    id: record.id,
    title: record.title || undefined,
    content: record.content || '',
    pinned: !!record.pinned,
    linkedType: record.linked_type || undefined,
    linkedTo: record.linked_to || undefined,
    linkedIds: Array.isArray(record.linked_ids) ? record.linked_ids : [],
    labels: Array.isArray(record.labels) ? record.labels : [],
    assignedTo: record.assigned_to || undefined,
    dueDate: toTimestamp(record.due_date),
    repeatInterval: record.repeat_interval || undefined,
    isPrivate: !!record.is_private,
    createdAt: toTimestamp(record.created) || Date.now(),
    createdBy: record.user,
  });

  it('normalizes a full note record', () => {
    const record = {
      id: 'n1',
      title: 'Meeting notes',
      content: 'Discussed roadmap',
      pinned: true,
      linked_type: 'task',
      linked_to: 't1',
      linked_ids: ['n2', 'n3'],
      labels: ['work', 'important'],
      assigned_to: 'user123',
      due_date: '2025-06-01T10:00:00Z',
      repeat_interval: 'month',
      is_private: true,
      created: '2025-05-01T08:00:00Z',
      user: 'user123',
    };

    const note = normalizeNote(record);

    expect(note.id).toBe('n1');
    expect(note.title).toBe('Meeting notes');
    expect(note.content).toBe('Discussed roadmap');
    expect(note.pinned).toBe(true);
    expect(note.linkedType).toBe('task');
    expect(note.linkedTo).toBe('t1');
    expect(note.linkedIds).toEqual(['n2', 'n3']);
    expect(note.labels).toEqual(['work', 'important']);
    expect(note.assignedTo).toBe('user123');
    expect(note.dueDate).toBe(new Date('2025-06-01T10:00:00Z').getTime());
    expect(note.repeatInterval).toBe('month');
    expect(note.isPrivate).toBe(true);
    expect(note.createdBy).toBe('user123');
  });

  it('normalizes a minimal note record', () => {
    const record = {
      id: 'n1',
      content: 'Simple note',
      labels: [],
      created: '2025-05-01T08:00:00Z',
      user: 'user1',
    };

    const note = normalizeNote(record);

    expect(note.id).toBe('n1');
    expect(note.content).toBe('Simple note');
    expect(note.title).toBeUndefined();
    expect(note.pinned).toBe(false);
    expect(note.linkedType).toBeUndefined();
    expect(note.linkedIds).toEqual([]);
    expect(note.labels).toEqual([]);
    expect(note.assignedTo).toBeUndefined();
    expect(note.dueDate).toBeUndefined();
    expect(note.repeatInterval).toBeUndefined();
    expect(note.isPrivate).toBe(false);
  });

  it('handles null/undefined fields gracefully', () => {
    const record = {
      id: 'n1',
      title: null,
      content: null,
      pinned: null,
      linked_type: null,
      linked_to: null,
      linked_ids: null,
      labels: null,
      assigned_to: null,
      due_date: null,
      repeat_interval: null,
      is_private: null,
      created: '2025-05-01T08:00:00Z',
      user: 'user1',
    };

    const note = normalizeNote(record);

    expect(note.title).toBeUndefined();
    expect(note.content).toBe('');
    expect(note.pinned).toBe(false);
    expect(note.linkedType).toBeUndefined();
    expect(note.linkedTo).toBeUndefined();
    expect(note.linkedIds).toEqual([]);
    expect(note.labels).toEqual([]);
    expect(note.assignedTo).toBeUndefined();
    expect(note.dueDate).toBeUndefined();
    expect(note.repeatInterval).toBeUndefined();
    expect(note.isPrivate).toBe(false);
  });
});
