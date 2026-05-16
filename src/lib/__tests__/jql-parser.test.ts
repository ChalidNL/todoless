import { describe, it, expect } from 'vitest';
import {
  parseJQL,
  evaluateJQL,
  filterTasks,
  type EvaluatableTask,
} from '../jql-parser';

// Test helpers
const makeTask = (overrides: Partial<EvaluatableTask> = {}): EvaluatableTask => ({
  title: 'Test Task',
  status: 'todo',
  priority: 'normal',
  labels: [],
  ...overrides,
});

const labelResolver = (name: string): string | null => {
  const map: Record<string, string> = {
    work: 'label-work-id',
    personal: 'label-personal-id',
    urgent: 'label-urgent-id',
  };
  return map[name.toLowerCase()] || null;
};

describe('parseJQL', () => {
  describe('basic field filters', () => {
    it('parses status:todo', () => {
      const { ast, errors } = parseJQL('status:todo');
      expect(errors).toHaveLength(0);
      expect(ast).not.toBeNull();
      expect(ast).toEqual({
        kind: 'field',
        field: 'status',
        operator: '=',
        value: 'todo',
      });
    });

    it('parses priority:urgent', () => {
      const { ast } = parseJQL('priority:urgent');
      expect(ast).toEqual({
        kind: 'field',
        field: 'priority',
        operator: '=',
        value: 'urgent',
      });
    });

    it('parses assignee:john', () => {
      const { ast } = parseJQL('assignee:john');
      expect(ast).toEqual({
        kind: 'field',
        field: 'assignee',
        operator: '=',
        value: 'john',
      });
    });
  });

  describe('label shorthand', () => {
    it('parses #work', () => {
      const { ast, errors } = parseJQL('#work');
      expect(errors).toHaveLength(0);
      expect(ast).toEqual({
        kind: 'label',
        name: 'work',
      });
    });

    it('parses multiple labels', () => {
      const { ast } = parseJQL('#work #urgent');
      expect(ast).toEqual({
        kind: 'and',
        children: [
          { kind: 'label', name: 'work' },
          { kind: 'label', name: 'urgent' },
        ],
      });
    });
  });

  describe('boolean operators', () => {
    it('parses AND', () => {
      const { ast } = parseJQL('status:todo AND priority:urgent');
      expect(ast).toEqual({
        kind: 'and',
        children: [
          { kind: 'field', field: 'status', operator: '=', value: 'todo' },
          { kind: 'field', field: 'priority', operator: '=', value: 'urgent' },
        ],
      });
    });

    it('parses OR', () => {
      const { ast } = parseJQL('status:todo OR status:backlog');
      expect(ast).toEqual({
        kind: 'or',
        children: [
          { kind: 'field', field: 'status', operator: '=', value: 'todo' },
          { kind: 'field', field: 'status', operator: '=', value: 'backlog' },
        ],
      });
    });

    it('parses NOT', () => {
      const { ast } = parseJQL('NOT status:done');
      expect(ast).toEqual({
        kind: 'not',
        children: [
          { kind: 'field', field: 'status', operator: '=', value: 'done' },
        ],
      });
    });
  });

  describe('parentheses', () => {
    it('parses grouped expressions', () => {
      const { ast } = parseJQL('(status:todo OR status:backlog) AND priority:urgent');
      expect(ast).toEqual({
        kind: 'and',
        children: [
          {
            kind: 'or',
            children: [
              { kind: 'field', field: 'status', operator: '=', value: 'todo' },
              { kind: 'field', field: 'status', operator: '=', value: 'backlog' },
            ],
          },
          { kind: 'field', field: 'priority', operator: '=', value: 'urgent' },
        ],
      });
    });
  });

  describe('free text', () => {
    it('parses free text as text filter', () => {
      const { ast } = parseJQL('my search terms');
      expect(ast).toEqual({
        kind: 'and',
        children: [
          { kind: 'text', text: 'my' },
          { kind: 'text', text: 'search' },
          { kind: 'text', text: 'terms' },
        ],
      });
    });
  });

  describe('mixed queries', () => {
    it('parses field:value with text', () => {
      const { ast } = parseJQL('status:todo my task');
      expect(ast).toEqual({
        kind: 'and',
        children: [
          { kind: 'field', field: 'status', operator: '=', value: 'todo' },
          { kind: 'text', text: 'my' },
          { kind: 'text', text: 'task' },
        ],
      });
    });

    it('parses label with field', () => {
      const { ast } = parseJQL('#work status:todo');
      expect(ast).toEqual({
        kind: 'and',
        children: [
          { kind: 'label', name: 'work' },
          { kind: 'field', field: 'status', operator: '=', value: 'todo' },
        ],
      });
    });
  });

  describe('empty input', () => {
    it('returns null ast for empty string', () => {
      const { ast, errors } = parseJQL('');
      expect(errors).toHaveLength(0);
      expect(ast).toBeNull();
    });

    it('returns null ast for whitespace only', () => {
      const { ast, errors } = parseJQL('   ');
      expect(errors).toHaveLength(0);
      expect(ast).toBeNull();
    });
  });
});

describe('evaluateJQL', () => {
  describe('field filters', () => {
    it('matches status', () => {
      const { ast } = parseJQL('status:todo');
      expect(evaluateJQL(ast, makeTask({ status: 'todo' }))).toBe(true);
      expect(evaluateJQL(ast, makeTask({ status: 'done' }))).toBe(false);
    });

    it('matches priority', () => {
      const { ast } = parseJQL('priority:urgent');
      expect(evaluateJQL(ast, makeTask({ priority: 'urgent' }))).toBe(true);
      expect(evaluateJQL(ast, makeTask({ priority: 'normal' }))).toBe(false);
    });

    it('matches blocked', () => {
      const { ast } = parseJQL('blocked:true');
      expect(evaluateJQL(ast, makeTask({ blocked: true }))).toBe(true);
      expect(evaluateJQL(ast, makeTask({ blocked: false }))).toBe(false);
    });
  });

  describe('label filters', () => {
    it('matches label by name with resolver', () => {
      const { ast } = parseJQL('#work');
      const task = makeTask({ labels: ['label-work-id', 'label-other'] });
      expect(evaluateJQL(ast, task, labelResolver)).toBe(true);
    });

    it('does not match missing label', () => {
      const { ast } = parseJQL('#work');
      const task = makeTask({ labels: ['label-other'] });
      expect(evaluateJQL(ast, task, labelResolver)).toBe(false);
    });
  });

  describe('boolean operators', () => {
    it('evaluates AND', () => {
      const { ast } = parseJQL('status:todo AND priority:urgent');
      const task = makeTask({ status: 'todo', priority: 'urgent' });
      expect(evaluateJQL(ast, task)).toBe(true);
    });

    it('evaluates OR', () => {
      const { ast } = parseJQL('status:todo OR status:done');
      const task = makeTask({ status: 'done' });
      expect(evaluateJQL(ast, task)).toBe(true);
    });

    it('evaluates NOT', () => {
      const { ast } = parseJQL('NOT status:done');
      const task = makeTask({ status: 'todo' });
      expect(evaluateJQL(ast, task)).toBe(true);
    });
  });

  describe('free text', () => {
    it('matches title text', () => {
      const { ast } = parseJQL('search');
      const task = makeTask({ title: 'This is a search task' });
      expect(evaluateJQL(ast, task)).toBe(true);
    });

    it('does not match non-existent text', () => {
      const { ast } = parseJQL('missing');
      const task = makeTask({ title: 'This is a task' });
      expect(evaluateJQL(ast, task)).toBe(false);
    });
  });

  describe('null ast', () => {
    it('returns true for null ast (match all)', () => {
      expect(evaluateJQL(null, makeTask())).toBe(true);
    });
  });
});

describe('filterTasks', () => {
  const tasks: EvaluatableTask[] = [
    makeTask({ id: '1', title: 'Work task', status: 'todo', priority: 'urgent', labels: ['label-work-id'] }),
    makeTask({ id: '2', title: 'Personal task', status: 'todo', priority: 'normal', labels: ['label-personal-id'] }),
    makeTask({ id: '3', title: 'Done task', status: 'done', priority: 'low', labels: [] }),
    makeTask({ id: '4', title: 'Blocked task', status: 'todo', priority: 'normal', blocked: true, labels: ['label-work-id'] }),
  ];

  it('filters by status', () => {
    const result = filterTasks('status:todo', tasks);
    expect(result).toHaveLength(3);
    expect(result.every(t => t.status === 'todo')).toBe(true);
  });

  it('filters by priority', () => {
    const result = filterTasks('priority:urgent', tasks);
    expect(result).toHaveLength(1);
    expect(result[0].priority).toBe('urgent');
  });

  it('filters by blocked', () => {
    const result = filterTasks('blocked:true', tasks);
    expect(result).toHaveLength(1);
    expect(result[0].blocked).toBe(true);
  });

  it('filters with OR', () => {
    const result = filterTasks('status:todo OR status:done', tasks);
    expect(result).toHaveLength(4);
  });

  it('filters with NOT', () => {
    const result = filterTasks('NOT status:done', tasks);
    expect(result).toHaveLength(3);
  });

  it('filters with complex query', () => {
    const result = filterTasks('status:todo AND (priority:urgent OR blocked:true)', tasks);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toContain('1');
    expect(result.map(t => t.id)).toContain('4');
  });

  it('returns all tasks for empty query', () => {
    const result = filterTasks('', tasks);
    expect(result).toHaveLength(4);
  });

  it('falls back to text search on parse error', () => {
    const result = filterTasks('work', tasks);
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain('Work');
  });
});

describe('JQL edge cases', () => {
  it('handles case-insensitive field names', () => {
    const { ast } = parseJQL('STATUS:todo');
    expect(ast).toEqual({
      kind: 'field',
      field: 'status',
      operator: '=',
      value: 'todo',
    });
  });

  it('handles multiple spaces', () => {
    const { ast } = parseJQL('status:todo   priority:urgent');
    expect(ast).toEqual({
      kind: 'and',
      children: [
        { kind: 'field', field: 'status', operator: '=', value: 'todo' },
        { kind: 'field', field: 'priority', operator: '=', value: 'urgent' },
      ],
    });
  });

  it('handles horizon field', () => {
    const { ast } = parseJQL('horizon:week');
    expect(ast).toEqual({
      kind: 'field',
      field: 'horizon',
      operator: '=',
      value: 'week',
    });
  });

  it('handles project field', () => {
    const { ast } = parseJQL('project:proj123');
    expect(ast).toEqual({
      kind: 'field',
      field: 'project',
      operator: '=',
      value: 'proj123',
    });
  });

  it('handles sprint field', () => {
    const { ast } = parseJQL('sprint:sprint456');
    expect(ast).toEqual({
      kind: 'field',
      field: 'sprint',
      operator: '=',
      value: 'sprint456',
    });
  });
});
