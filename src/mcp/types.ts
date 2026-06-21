export type JsonObject = Record<string, unknown>;

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonObject;
  mutating: boolean;
  handler: (args: JsonObject) => Promise<unknown>;
}

export interface TodolessMcpConfig {
  pbUrl: string;
  userToken: string;
  transport: 'stdio' | 'http';
  readonly: boolean;
  rateLimitPerMinute: number;
  httpPort: number;
}

export interface TodolessEntry {
  id: string;
  type?: 'task' | 'grocery';
  title?: string;
  status?: string;
  completed?: boolean;
  [key: string]: unknown;
}

export interface TodolessPocketBaseClient {
  listEntries(params?: JsonObject): Promise<unknown[]>;
  getEntry(id: string): Promise<unknown>;
  listGroceries(params?: JsonObject): Promise<unknown[]>;
  getCurrentRun(): Promise<unknown>;
  listMembers(): Promise<unknown[]>;
  listSavedFilters(): Promise<unknown[]>;
  createTask(params: JsonObject): Promise<unknown>;
  updateTask(params: JsonObject): Promise<unknown>;
  completeTask(taskId: string): Promise<unknown>;
  deleteTask(taskId: string): Promise<unknown>;
  addSubtask(params: JsonObject): Promise<unknown>;
  toggleSubtask(params: JsonObject): Promise<unknown>;
  commitToRun(params: JsonObject): Promise<unknown>;
  addGrocery(params: JsonObject): Promise<unknown>;
  toggleGrocery(params: JsonObject): Promise<unknown>;
  setKaizenNote(note: string): Promise<unknown>;
}
