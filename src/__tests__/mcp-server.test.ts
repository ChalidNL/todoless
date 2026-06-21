import { describe, expect, it, vi } from 'vitest';
import { buildToolDefinitions, createTodolessMcpContext, translatePocketBaseError } from '../mcp/core';
import type { TodolessPocketBaseClient } from '../mcp/pb-client';

const makeClient = (overrides: Partial<TodolessPocketBaseClient> = {}): TodolessPocketBaseClient => ({
  listEntries: vi.fn().mockResolvedValue([]),
  getEntry: vi.fn().mockResolvedValue({ id: 'task-1', type: 'task', title: 'Lampje vervangen', status: 'todo' }),
  listGroceries: vi.fn().mockResolvedValue([]),
  getCurrentRun: vi.fn().mockResolvedValue({ id: 'run-1', status: 'active', commitments: [] }),
  listMembers: vi.fn().mockResolvedValue([]),
  listSavedFilters: vi.fn().mockResolvedValue([]),
  createTask: vi.fn().mockResolvedValue({ id: 'task-1', type: 'task', title: 'Nieuwe taak', status: 'todo' }),
  updateTask: vi.fn().mockResolvedValue({ id: 'task-1', type: 'task', title: 'Aangepast', status: 'todo' }),
  completeTask: vi.fn().mockResolvedValue({ id: 'task-1', type: 'task', status: 'done', message: 'Taak was al afgerond' }),
  deleteTask: vi.fn().mockResolvedValue({ id: 'task-1', deleted: true }),
  addSubtask: vi.fn().mockResolvedValue({ id: 'sub-1', title: 'Subtaak', status: 'todo' }),
  toggleSubtask: vi.fn().mockResolvedValue({ id: 'sub-1', status: 'done' }),
  commitToRun: vi.fn().mockResolvedValue({ id: 'commit-1', task_id: 'task-1' }),
  addGrocery: vi.fn().mockResolvedValue({ id: 'item-1', title: 'Melk', completed: false }),
  toggleGrocery: vi.fn().mockResolvedValue({ id: 'item-1', completed: true }),
  setKaizenNote: vi.fn().mockResolvedValue({ id: 'run-1', kaizen_note: 'Rustiger plannen' }),
  ...overrides,
});

describe('TodoLess MCP tool registry', () => {
  it('registers only read tools when TODOLESS_MCP_READONLY=true', () => {
    const tools = buildToolDefinitions(createTodolessMcpContext({ readonly: true, client: makeClient() }));
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining(['list_inbox', 'list_tasks', 'get_task', 'list_groceries', 'get_current_run', 'list_members', 'list_saved_filters']));
    expect(names).not.toContain('create_task');
    expect(names).not.toContain('complete_task');
    expect(names).not.toContain('delete_task');
    expect(names).not.toContain('commit_to_run');
  });

  it('requires confirm:true before delete_task calls PocketBase', async () => {
    const client = makeClient();
    const tools = buildToolDefinitions(createTodolessMcpContext({ readonly: false, client }));
    const deleteTask = tools.find((tool) => tool.name === 'delete_task');

    await expect(deleteTask?.handler({ task_id: 'task-1' })).rejects.toThrow('confirm:true');
    expect(client.deleteTask).not.toHaveBeenCalled();
  });

  it('turns PocketBase WIP errors into agent-friendly commit_to_run errors', async () => {
    const client = makeClient({
      commitToRun: vi.fn().mockRejectedValue({ status: 400, data: { message: 'WIP limit exceeded' } }),
    });
    const tools = buildToolDefinitions(createTodolessMcpContext({ readonly: false, client }));
    const commit = tools.find((tool) => tool.name === 'commit_to_run');

    await expect(commit?.handler({ task_id: 'task-1' })).rejects.toThrow('Run vol — eerst iets afmaken');
  });

  it('returns changed objects from mutating tools', async () => {
    const client = makeClient();
    const tools = buildToolDefinitions(createTodolessMcpContext({ readonly: false, client }));
    const create = tools.find((tool) => tool.name === 'create_task');

    await expect(create?.handler({ title: 'Nieuwe taak', inbox: true })).resolves.toMatchObject({ id: 'task-1', title: 'Nieuwe taak' });
    expect(client.createTask).toHaveBeenCalledWith({ title: 'Nieuwe taak', inbox: true });
  });
});

describe('translatePocketBaseError', () => {
  it('redacts bearer tokens and explains validation errors', () => {
    const msg = translatePocketBaseError({
      status: 400,
      data: { message: 'validation_required: title required Bearer secret-token-123' },
    });

    expect(msg).toBe('Taak heeft een titel nodig.');
    expect(msg).not.toContain('secret-token-123');
  });
});
