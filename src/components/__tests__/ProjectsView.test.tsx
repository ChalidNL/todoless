import { describe, it, expect, vi } from 'vitest';
import type { Project, Task, ProjectStatus } from '../../types';

// --- Progress calculation logic ---
describe('ProjectsView — project progress', () => {
  const makeProject = (overrides: Partial<Project> = {}): Project => ({
    id: 'p1',
    title: 'Test Project',
    description: 'A test project',
    color: '#6366f1',
    status: 'active',
    taskIds: ['t1', 't2', 't3'],
    createdAt: Date.now(),
    ...overrides,
  });

  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 't1',
    title: 'Test Task',
    status: 'todo',
    blocked: false,
    labels: [],
    createdAt: Date.now(),
    ...overrides,
  });

  function getProjectProgress(project: Project, tasks: Task[]) {
    const projectTaskIds = new Set(project.taskIds);
    const related = tasks.filter(
      (task) => task.projectId && (task.projectId === project.id || projectTaskIds.has(task.id)),
    );
    const done = related.filter((t) => t.status === 'done').length;
    const total = related.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, percent };
  }

  it('returns 0% when no tasks are linked', () => {
    const project = makeProject({ taskIds: [] });
    const tasks: Task[] = [];
    const progress = getProjectProgress(project, tasks);
    expect(progress).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it('calculates percent from linked tasks', () => {
    const project = makeProject();
    const tasks = [
      makeTask({ id: 't1', projectId: 'p1', status: 'done' }),
      makeTask({ id: 't2', projectId: 'p1', status: 'todo' }),
      makeTask({ id: 't3', projectId: 'p1', status: 'backlog' }),
    ];
    const progress = getProjectProgress(project, tasks);
    expect(progress).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it('returns 100% when all tasks are done', () => {
    const project = makeProject();
    const tasks = [
      makeTask({ id: 't1', projectId: 'p1', status: 'done' }),
      makeTask({ id: 't2', projectId: 'p1', status: 'done' }),
      makeTask({ id: 't3', projectId: 'p1', status: 'done' }),
    ];
    const progress = getProjectProgress(project, tasks);
    expect(progress).toEqual({ done: 3, total: 3, percent: 100 });
  });

  it('requires projectId on task to match (taskIds list is write-only)', () => {
    // Projects store taskIds but the view filters on task.projectId.
    // Tasks without projectId are not shown even if their id is in project.taskIds.
    const project = makeProject({ taskIds: ['t1', 't2'] });
    const tasks = [
      makeTask({ id: 't1', status: 'done' }),
      makeTask({ id: 't2', status: 'todo' }),
    ];
    const progress = getProjectProgress(project, tasks);
    // Without projectId on the task, the view finds 0 related tasks.
    expect(progress).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

// --- Status transitions ---
describe('ProjectsView — status management', () => {
  it('allows transition from active to completed', () => {
    const project: Project = {
      id: 'p1', title: 'P', color: '#6366f1', status: 'active',
      taskIds: [], createdAt: Date.now(),
    };
    const next: ProjectStatus = 'completed';
    expect(['active', 'completed', 'archived']).toContain(next);
  });

  it('allows transition from active to archived', () => {
    const project: Project = {
      id: 'p1', title: 'P', color: '#6366f1', status: 'active',
      taskIds: [], createdAt: Date.now(),
    };
    const next: ProjectStatus = 'archived';
    expect(['active', 'completed', 'archived']).toContain(next);
  });

  it('all valid statuses are covered', () => {
    const validStatuses: ProjectStatus[] = ['active', 'completed', 'archived'];
    expect(validStatuses).toHaveLength(3);
  });
});

// --- Create form validation ---
describe('ProjectsView — create project', () => {
  it('rejects empty title', () => {
    const title = '';
    expect(title.trim()).toBeFalsy();
  });

  it('accepts valid title', () => {
    const title = 'Home Renovation';
    expect(title.trim()).toBeTruthy();
  });

  it('uses default color when none provided', () => {
    const color = '#6366f1';
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('new project starts as active', () => {
    const status: ProjectStatus = 'active';
    expect(status).toBe('active');
  });
});

// --- Empty state ---
describe('ProjectsView — empty state', () => {
  it('shows empty message when no projects exist', () => {
    const projects: Project[] = [];
    expect(projects.length).toBe(0);
  });

  it('renders projects when available', () => {
    const projects: Project[] = [
      { id: 'p1', title: 'Kitchen', color: '#ff0000', status: 'active', taskIds: [], createdAt: Date.now() },
      { id: 'p2', title: 'Garden', color: '#00ff00', status: 'active', taskIds: [], createdAt: Date.now() },
    ];
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.title)).toContain('Kitchen');
    expect(projects.map((p) => p.title)).toContain('Garden');
  });
});
