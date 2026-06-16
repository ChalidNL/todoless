import { z } from 'zod';
import type { JsonObject, McpToolDefinition, TodolessMcpConfig, TodolessPocketBaseClient } from './types';

export interface TodolessMcpContext {
  readonly: boolean;
  rateLimitPerMinute: number;
  client: TodolessPocketBaseClient;
  now: () => number;
  mutationTimestamps: number[];
}

const jsonSchema = (shape: JsonObject): JsonObject => ({ type: 'object', additionalProperties: false, properties: shape });
const text = (description: string): JsonObject => ({ type: 'string', description });
const bool = (description: string): JsonObject => ({ type: 'boolean', description });
const arr = (description: string): JsonObject => ({ type: 'array', description, items: { type: 'string' } });

export function createTodolessMcpContext(args: { readonly: boolean; client: TodolessPocketBaseClient; rateLimitPerMinute?: number; now?: () => number }): TodolessMcpContext {
  return {
    readonly: args.readonly,
    rateLimitPerMinute: args.rateLimitPerMinute ?? 30,
    client: args.client,
    now: args.now ?? (() => Date.now()),
    mutationTimestamps: [],
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): TodolessMcpConfig {
  const pbUrl = env.TODOLESS_PB_URL || 'http://pocketbase:8090';
  const userToken = env.TODOLESS_USER_TOKEN || '';
  const transport = env.TODOLESS_MCP_TRANSPORT === 'http' ? 'http' : 'stdio';
  const readonly = String(env.TODOLESS_MCP_READONLY ?? 'true').toLowerCase() !== 'false';
  const rateLimitPerMinute = Number(env.TODOLESS_MCP_RATE_LIMIT || 30);
  const httpPort = Number(env.TODOLESS_MCP_HTTP_PORT || 3333);
  return { pbUrl, userToken, transport, readonly, rateLimitPerMinute, httpPort };
}

export function translatePocketBaseError(error: unknown): string {
  const raw = extractErrorMessage(error).replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]').replace(/tl_[A-Za-z0-9_-]+/g, 'tl_[REDACTED]');
  const lower = raw.toLowerCase();
  if (lower.includes('wip') || lower.includes('limit exceeded') || lower.includes('run full')) return 'Run vol — eerst iets afmaken.';
  if (lower.includes('title') && (lower.includes('required') || lower.includes('cannot be blank') || lower.includes('validation'))) return 'Taak heeft een titel nodig.';
  if (lower.includes('unauthorized') || lower.includes('401')) return 'Niet geautoriseerd voor deze todoless-actie.';
  if (lower.includes('forbidden') || lower.includes('403')) return 'Deze actie valt buiten de rechten van dit gebruikers-token.';
  if (lower.includes('not found') || lower.includes('404')) return 'Niet gevonden of buiten je gezinsscope.';
  if (lower.includes('no active run')) return 'Geen actieve Run gevonden.';
  return raw || 'PocketBase gaf een onbekende fout terug.';
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error) {
    const candidate = error as { data?: { message?: unknown; error?: unknown; data?: unknown }; status?: unknown; message?: unknown };
    return String(candidate.data?.message || candidate.data?.error || candidate.message || candidate.status || JSON.stringify(error));
  }
  return String(error ?? '');
}

function assertRequired(args: JsonObject, fields: string[]) {
  for (const field of fields) {
    if (args[field] === undefined || args[field] === null || String(args[field]).trim() === '') throw new Error(`${field} required`);
  }
}

function rateLimit(ctx: TodolessMcpContext) {
  if (ctx.rateLimitPerMinute <= 0) return;
  const cutoff = ctx.now() - 60_000;
  ctx.mutationTimestamps = ctx.mutationTimestamps.filter((stamp) => stamp >= cutoff);
  if (ctx.mutationTimestamps.length >= ctx.rateLimitPerMinute) throw new Error('Rate limit bereikt voor muterende todoless-tools. Probeer het over een minuut opnieuw.');
  ctx.mutationTimestamps.push(ctx.now());
}

function makeTool(ctx: TodolessMcpContext, definition: Omit<McpToolDefinition, 'handler'> & { handler: (args: JsonObject) => Promise<unknown> }): McpToolDefinition {
  return {
    ...definition,
    handler: async (args: JsonObject) => {
      try {
        if (definition.mutating) rateLimit(ctx);
        return await definition.handler(args ?? {});
      } catch (error) {
        throw new Error(translatePocketBaseError(error));
      }
    },
  };
}

export function buildToolDefinitions(ctx: TodolessMcpContext): McpToolDefinition[] {
  const readTools: McpToolDefinition[] = [
    makeTool(ctx, {
      name: 'list_inbox', title: 'List Inbox', mutating: false,
      description: 'Lees openstaande taken in de Inbox. Optionele filters: assignee, label, due.',
      inputSchema: jsonSchema({ assignee: text('Gebruiker-id of @me'), label: text('Label-id'), due: text('Due filter, bv. today/week/overdue') }),
      handler: (args) => ctx.client.listEntries({ ...args, type: 'task', status: 'todo', inbox: true }),
    }),
    makeTool(ctx, {
      name: 'list_tasks', title: 'List Tasks', mutating: false,
      description: 'Lees taken met status/filter. Ondersteunt status, assignee, due-range en carryover-min.',
      inputSchema: jsonSchema({ status: text('todo/done/backlog'), assignee: text('Gebruiker-id of @me'), due_from: text('Start due range'), due_to: text('Einde due range'), carryover_min: { type: 'number' } }),
      handler: (args) => ctx.client.listEntries({ ...args, type: 'task' }),
    }),
    makeTool(ctx, {
      name: 'get_task', title: 'Get Task', mutating: false,
      description: 'Lees details van één taak, inclusief beschikbare subtaakvelden en commitments indien aanwezig.',
      inputSchema: jsonSchema({ task_id: text('Taak-id') }),
      handler: async (args) => { assertRequired(args, ['task_id']); return ctx.client.getEntry(String(args.task_id)); },
    }),
    makeTool(ctx, {
      name: 'list_groceries', title: 'List Groceries', mutating: false,
      description: 'Lees boodschappen, optioneel per winkel.',
      inputSchema: jsonSchema({ shop_id: text('Winkel-id'), status: text('todo/done') }),
      handler: (args) => ctx.client.listGroceries(args),
    }),
    makeTool(ctx, {
      name: 'get_current_run', title: 'Get Current Run', mutating: false,
      description: 'Lees de actieve Run met de huidige commitments.',
      inputSchema: jsonSchema({}),
      handler: () => ctx.client.getCurrentRun(),
    }),
    makeTool(ctx, {
      name: 'list_members', title: 'List Members', mutating: false,
      description: 'Lees gezinsleden met naam en rol. PocketBase bepaalt de gezinsscope.',
      inputSchema: jsonSchema({}),
      handler: () => ctx.client.listMembers(),
    }),
    makeTool(ctx, {
      name: 'list_saved_filters', title: 'List Saved Filters', mutating: false,
      description: 'Lees beschikbare opgeslagen/dynamische filters.',
      inputSchema: jsonSchema({}),
      handler: () => ctx.client.listSavedFilters(),
    }),
  ];

  if (ctx.readonly) return readTools;

  const writeTools: McpToolDefinition[] = [
    makeTool(ctx, {
      name: 'create_task', title: 'Create Task', mutating: true,
      description: 'Maak een nieuwe taak aan. Default assignee blijft server-side @me; gebruik inbox=true voor Inbox.',
      inputSchema: jsonSchema({ title: text('Titel'), due: text('Due date'), priority: text('Prioriteit'), labels: arr('Label ids'), assignee: text('Gebruiker-id of @me'), inbox: bool('Plaats in Inbox') }),
      handler: async (args) => { assertRequired(args, ['title']); return ctx.client.createTask(args); },
    }),
    makeTool(ctx, {
      name: 'update_task', title: 'Update Task', mutating: true,
      description: 'Wijzig een taak. PocketBase valideert rechten en gezinsscope.',
      inputSchema: jsonSchema({ task_id: text('Taak-id'), title: text('Titel'), due: text('Due date'), priority: text('Prioriteit'), labels: arr('Label ids'), assignee: text('Gebruiker-id of @me'), status: text('todo/done/backlog') }),
      handler: async (args) => { assertRequired(args, ['task_id']); return ctx.client.updateTask(args); },
    }),
    makeTool(ctx, {
      name: 'complete_task', title: 'Complete Task', mutating: true,
      description: 'Markeer een taak als done. Is idempotent: al-afgerond is een no-op met melding.',
      inputSchema: jsonSchema({ task_id: text('Taak-id') }),
      handler: async (args) => { assertRequired(args, ['task_id']); return ctx.client.completeTask(String(args.task_id)); },
    }),
    makeTool(ctx, {
      name: 'delete_task', title: 'Delete Task', mutating: true,
      description: 'Verwijder een taak. Vereist expliciet confirm:true.',
      inputSchema: jsonSchema({ task_id: text('Taak-id'), confirm: bool('Moet true zijn om te verwijderen') }),
      handler: async (args) => { assertRequired(args, ['task_id']); if (args.confirm !== true) throw new Error('delete_task vereist confirm:true.'); return ctx.client.deleteTask(String(args.task_id)); },
    }),
    makeTool(ctx, {
      name: 'add_subtask', title: 'Add Subtask', mutating: true,
      description: 'Voeg een subtaak toe aan een bestaande taak.',
      inputSchema: jsonSchema({ task_id: text('Parent taak-id'), title: text('Subtaak titel') }),
      handler: async (args) => { assertRequired(args, ['task_id', 'title']); return ctx.client.addSubtask(args); },
    }),
    makeTool(ctx, {
      name: 'toggle_subtask', title: 'Toggle Subtask', mutating: true,
      description: 'Zet een subtaak op done/todo.',
      inputSchema: jsonSchema({ subtask_id: text('Subtaak-id'), done: bool('true=done, false=todo') }),
      handler: async (args) => { assertRequired(args, ['subtask_id']); return ctx.client.toggleSubtask(args); },
    }),
    makeTool(ctx, {
      name: 'commit_to_run', title: 'Commit To Run', mutating: true,
      description: 'Zet een taak op de actieve Run voor een lid. Respecteert WIP-limieten: PocketBase-fouten worden niet omzeild.',
      inputSchema: jsonSchema({ task_id: text('Taak-id'), member_id: text('Optioneel lid-id') }),
      handler: async (args) => { assertRequired(args, ['task_id']); return ctx.client.commitToRun(args); },
    }),
    makeTool(ctx, {
      name: 'add_grocery', title: 'Add Grocery', mutating: true,
      description: 'Voeg een boodschap toe.',
      inputSchema: jsonSchema({ title: text('Boodschap'), quantity: { type: 'number' }, shop_id: text('Winkel-id'), labels: arr('Label ids'), assignee: text('Gebruiker-id of @me') }),
      handler: async (args) => { assertRequired(args, ['title']); return ctx.client.addGrocery(args); },
    }),
    makeTool(ctx, {
      name: 'toggle_grocery', title: 'Toggle Grocery', mutating: true,
      description: 'Vink een boodschap aan of uit.',
      inputSchema: jsonSchema({ item_id: text('Boodschap-id'), done: bool('true=afgevinkt, false=open') }),
      handler: async (args) => { assertRequired(args, ['item_id']); return ctx.client.toggleGrocery(args); },
    }),
    makeTool(ctx, {
      name: 'set_kaizen_note', title: 'Set Kaizen Note', mutating: true,
      description: 'Schrijf de wekelijkse reflectie op de huidige Run.',
      inputSchema: jsonSchema({ note: text('Kaizen/reflection note') }),
      handler: async (args) => { assertRequired(args, ['note']); return ctx.client.setKaizenNote(String(args.note)); },
    }),
  ];

  return [...readTools, ...writeTools];
}

export const zodFromJsonObject = z.object({}).passthrough();
