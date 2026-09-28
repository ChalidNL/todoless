import { describe, expect, it } from 'vitest';
import {
  itemToEntry,
  removeById,
  taskToEntry,
  upsertById,
  upsertEntry,
} from '../lib/realtime-apply';
import type { Entry, Item, Task } from '../types';

const task = (id: string, title = id, status: Task['status'] = 'todo'): Task => ({
  id,
  title,
  status,
  blocked: false,
  flag: false,
  labels: [],
  createdAt: 1,
});

const item = (id: string, title = id, completed = false): Item => ({
  id,
  title,
  completed,
  labels: [],
  createdAt: 1,
});

const entry = (id: string, type: 'task' | 'item', completed = false): Entry => ({
  id,
  title: id,
  type,
  completed,
  labels: [],
  createdAt: 1,
});

describe('upsertById', () => {
  it('inserts new records at the front (newest first)', () => {
    const result = upsertById([task('a')], task('b'));
    expect(result.map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('replaces an existing record in place without reordering', () => {
    const result = upsertById([task('a'), task('b')], task('b', 'renamed', 'done'));
    expect(result.map((t) => t.id)).toEqual(['a', 'b']);
    expect(result[1].title).toBe('renamed');
    expect(result[1].status).toBe('done');
  });
});

describe('removeById', () => {
  it('removes the matching record and keeps order', () => {
    const result = removeById([task('a'), task('b'), task('c')], 'b');
    expect(result.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('returns the same array contents when the id is absent', () => {
    const result = removeById([task('a')], 'nope');
    expect(result.map((t) => t.id)).toEqual(['a']);
  });
});

describe('upsertEntry', () => {
  it('puts new tasks at the front of the task section', () => {
    const result = upsertEntry([entry('t1', 'task'), entry('t2', 'task'), entry('i1', 'item')], entry('t3', 'task'));
    expect(result.map((e) => e.id)).toEqual(['t3', 't1', 't2', 'i1']);
  });

  it('puts new items at the front of the item section', () => {
    const result = upsertEntry([entry('t1', 'task'), entry('i1', 'item'), entry('i2', 'item')], entry('i3', 'item'));
    expect(result.map((e) => e.id)).toEqual(['t1', 'i3', 'i1', 'i2']);
  });

  it('appends an item after the last task when no items exist yet', () => {
    const result = upsertEntry([entry('t1', 'task')], entry('i1', 'item'));
    expect(result.map((e) => e.id)).toEqual(['t1', 'i1']);
  });

  it('replaces an existing entry in place', () => {
    const result = upsertEntry([entry('t1', 'task'), entry('i1', 'item')], { ...entry('t1', 'task'), title: 'updated' });
    expect(result.map((e) => e.id)).toEqual(['t1', 'i1']);
    expect(result[0].title).toBe('updated');
  });
});

describe('taskToEntry', () => {
  it('marks a done task as completed', () => {
    expect(taskToEntry(task('t1', 't1', 'done'))).toMatchObject({ id: 't1', type: 'task', completed: true });
  });

  it('leaves a todo task uncompleted', () => {
    expect(taskToEntry(task('t1'))).toMatchObject({ id: 't1', type: 'task', completed: false });
  });
});

describe('itemToEntry', () => {
  it('maps a completed item to a done entry', () => {
    expect(itemToEntry(item('i1', 'i1', true))).toMatchObject({
      id: 'i1',
      type: 'item',
      completed: true,
      status: 'done',
      blocked: false,
      flag: false,
    });
  });

  it('maps an open item to a todo entry', () => {
    expect(itemToEntry(item('i1'))).toMatchObject({ id: 'i1', type: 'item', completed: false, status: 'todo' });
  });
});