import { describe, expect, it } from 'vitest';
import { parentTaskCandidates } from '../lib/parent-task-candidates';
import type { Task } from '../types';

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id, title: `Task ${id}`, status: 'todo', blocked: false, flag: false, labels: [], createdAt: 1, ...extra,
});

// The lists hide every task that has linkedType 'task' + linkedTo, and the
// parent card renders one level of subtasks. Picking the wrong parent therefore
// makes tasks vanish from the UI, not just look odd.
describe('parent task candidates', () => {
  const a = task('a');
  const b = task('b', { linkedTo: 'a', linkedType: 'task' }); // subtask of a
  const c = task('c');
  const d = task('d', { linkedTo: 'c', linkedType: 'task' }); // subtask of c
  const done = task('done', { status: 'done' });
  const all = [a, b, c, d, done];

  it('never offers the task itself or done tasks', () => {
    expect(parentTaskCandidates(all, a, '').map((t) => t.id)).not.toContain('a');
    expect(parentTaskCandidates(all, a, '').map((t) => t.id)).not.toContain('done');
  });

  it("does not offer the task's own subtask (A -> B -> A would hide both)", () => {
    expect(parentTaskCandidates(all, a, '').map((t) => t.id)).not.toContain('b');
  });

  it('does not offer a subtask of another task (one level only)', () => {
    expect(parentTaskCandidates(all, a, '').map((t) => t.id)).not.toContain('d');
    expect(parentTaskCandidates(all, a, '').map((t) => t.id)).toEqual(['c']);
  });

  it('survives a cycle that is already in the data', () => {
    const x = task('x', { linkedTo: 'y', linkedType: 'task' });
    const y = task('y', { linkedTo: 'x', linkedType: 'task' });
    const z = task('z');
    expect(parentTaskCandidates([x, y, z], z, '').map((t) => t.id)).toEqual([]);
    expect(parentTaskCandidates([x, y, z], x, '').map((t) => t.id)).toEqual(['z']);
  });

  it('filters by title and caps the list', () => {
    const many = Array.from({ length: 10 }, (_, i) => task(`t${i}`, { title: i % 2 ? 'Groceries' : 'Garden' }));
    expect(parentTaskCandidates(many, a, 'gard')).toHaveLength(5);
    expect(parentTaskCandidates(many, a, '')).toHaveLength(6);
  });
});
