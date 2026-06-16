import type { JsonObject, TodolessPocketBaseClient } from './types';

export { type TodolessPocketBaseClient } from './types';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const stripSlash = (value: string) => value.replace(/\/+$/, '');

export class PocketBaseHttpClient implements TodolessPocketBaseClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = stripSlash(baseUrl);
    this.token = token;
  }

  async listEntries(params: JsonObject = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query}` : '';
    return this.request<unknown[]>(`/api/entries${suffix}`);
  }

  async getEntry(id: string) {
    const task = await this.tryRequest(`/api/collections/tasks/records/${encodeURIComponent(id)}`);
    if (task) return { ...(task as JsonObject), type: 'task' };
    const item = await this.tryRequest(`/api/collections/items/records/${encodeURIComponent(id)}`);
    if (item) return { ...(item as JsonObject), type: 'grocery' };
    throw { status: 404, data: { message: 'Entry not found' } };
  }

  async listGroceries(params: JsonObject = {}) {
    return this.listEntries({ ...params, type: 'grocery', status: params.status ?? 'todo' });
  }

  async getCurrentRun() {
    const result = await this.collectionList('sprints', 'status = "active"', '-start_date', 1);
    const run = result.items[0] ?? null;
    if (!run) return { id: null, status: 'none', commitments: [], message: 'Geen actieve Run gevonden.' };
    const commitments = await this.collectionList('tasks', `sprint_id = "${String((run as JsonObject).id)}" && status != "done"`, '-created', 100);
    return { ...run, commitments: commitments.items };
  }

  async listMembers() {
    const result = await this.collectionList('users', '', 'name', 100);
    return result.items.map((user) => ({
      id: user.id,
      name: user.name || user.email || user.id,
      role: user.role || 'member',
      member_type: user.member_type || 'human',
      member_status: user.member_status || 'active',
    }));
  }

  async listSavedFilters() {
    const result = await this.tryRequest<{ items: unknown[] }>('/api/collections/saved_filters/records?perPage=200&sort=sort,name');
    return result?.items ?? [];
  }

  async createTask(params: JsonObject) {
    return this.request('/api/v1', { method: 'POST', body: { action: 'create', type: 'task', ...params } });
  }

  async updateTask(params: JsonObject) {
    const taskId = String(params.task_id || params.id || '');
    if (!taskId) throw { status: 400, data: { message: 'task_id required' } };
    const body = { ...params };
    delete body.task_id;
    delete body.id;
    if ('due' in body && !('due_date' in body)) body.due_date = body.due;
    if ('assignee' in body && !('assigned_to' in body)) body.assigned_to = body.assignee;
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', body });
  }

  async completeTask(taskId: string) {
    const current = await this.getEntry(taskId);
    if ((current as JsonObject).status === 'done') return { ...current as JsonObject, message: 'Taak was al afgerond.' };
    return this.request('/api/v1', { method: 'POST', body: { action: 'complete', id: taskId, type: 'task' } });
  }

  async deleteTask(taskId: string) {
    return this.request('/api/v1', { method: 'POST', body: { action: 'delete', id: taskId, type: 'task' } });
  }

  async addSubtask(params: JsonObject) {
    const taskId = String(params.task_id || '');
    if (!taskId) throw { status: 400, data: { message: 'task_id required' } };
    return this.request(`/api/tasks/${encodeURIComponent(taskId)}/subtasks`, { method: 'POST', body: { title: params.title } });
  }

  async toggleSubtask(params: JsonObject) {
    const subtaskId = String(params.subtask_id || '');
    if (!subtaskId) throw { status: 400, data: { message: 'subtask_id required' } };
    return this.request(`/api/subtasks/${encodeURIComponent(subtaskId)}`, { method: 'PATCH', body: { status: params.done === false ? 'todo' : 'done' } });
  }

  async commitToRun(params: JsonObject) {
    const taskId = String(params.task_id || '');
    if (!taskId) throw { status: 400, data: { message: 'task_id required' } };
    const run = await this.getCurrentRun() as JsonObject;
    if (!run.id) throw { status: 400, data: { message: 'No active run' } };
    return this.request(`/api/collections/tasks/records/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      body: { sprint_id: run.id, assigned_to: params.member_id || params.assignee || undefined },
    });
  }

  async addGrocery(params: JsonObject) {
    return this.request('/api/groceries', { method: 'POST', body: { title: params.title, quantity: params.quantity, shop_id: params.shop_id, labels: params.labels, assigned_to: params.assignee } });
  }

  async toggleGrocery(params: JsonObject) {
    const itemId = String(params.item_id || '');
    if (!itemId) throw { status: 400, data: { message: 'item_id required' } };
    return this.request(`/api/groceries/${encodeURIComponent(itemId)}`, { method: 'PATCH', body: { completed: params.done !== false } });
  }

  async setKaizenNote(note: string) {
    const run = await this.getCurrentRun() as JsonObject;
    if (!run.id) throw { status: 400, data: { message: 'No active run' } };
    return this.request(`/api/collections/sprints/records/${encodeURIComponent(String(run.id))}`, { method: 'PATCH', body: { kaizen_note: note } });
  }

  private async collectionList(collection: string, filter: string, sort: string, perPage: number): Promise<{ items: JsonObject[] }> {
    const params = new URLSearchParams({ perPage: String(perPage), sort });
    if (filter) params.set('filter', filter);
    return this.request(`/api/collections/${collection}/records?${params.toString()}`);
  }

  private async tryRequest<T = unknown>(path: string): Promise<T | null> {
    try {
      return await this.request<T>(path);
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : undefined;
      if (status === 404) return null;
      throw error;
    }
  }

  private async request<T = unknown>(path: string, options: { method?: HttpMethod; body?: JsonObject } = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw { status: response.status, data };
    return data as T;
  }
}
