import { createServer, type IncomingMessage } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { buildToolDefinitions, createTodolessMcpContext, loadConfig } from './core';
import { PocketBaseHttpClient } from './pb-client';
import type { TodolessMcpConfig, TodolessPocketBaseClient } from './types';

const resultContent = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
});

export function createTodolessMcpServer(config: TodolessMcpConfig, client: TodolessPocketBaseClient = new PocketBaseHttpClient(config.pbUrl, config.userToken)) {
  if (!config.userToken) throw new Error('TODOLESS_USER_TOKEN is required. Gebruik een PocketBase gebruikers-token, geen admin-token.');

  const server = new McpServer({ name: 'todoless-mcp', version: '0.1.0' }, { capabilities: { tools: {}, resources: {}, prompts: {} } });
  const ctx = createTodolessMcpContext({ readonly: config.readonly, rateLimitPerMinute: config.rateLimitPerMinute, client });

  for (const tool of buildToolDefinitions(ctx)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: z.object({}).passthrough(),
        annotations: { readOnlyHint: !tool.mutating, destructiveHint: tool.name.startsWith('delete_') },
        _meta: { jsonSchema: tool.inputSchema },
      },
      async (args) => resultContent(await tool.handler(args)),
    );
  }

  server.registerResource('current_run', 'todoless://current-run', {
    title: 'Huidige Run',
    description: 'Actieve todoless Run met commitments.',
    mimeType: 'application/json',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await client.getCurrentRun(), null, 2) }] }));

  server.registerResource('inbox', 'todoless://inbox', {
    title: 'Inbox',
    description: 'Openstaande Inbox taken.',
    mimeType: 'application/json',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await client.listEntries({ type: 'task', status: 'todo', inbox: true }), null, 2) }] }));

  server.registerResource('my_tasks', 'todoless://my-tasks', {
    title: 'Mijn taken',
    description: 'Openstaande taken voor de MCP-identiteit.',
    mimeType: 'application/json',
  }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await client.listEntries({ type: 'task', status: 'todo', assignee: '@me' }), null, 2) }] }));

  server.registerPrompt('plan_my_week', {
    title: 'Plan mijn week',
    description: 'Lees Inbox en huidige Run, stel maximaal drie taken voor, vraag bevestiging vóór commit_to_run.',
    argsSchema: { focus: z.string().optional().describe('Optionele weekfocus of thema') },
  }, ({ focus }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Plan mijn week in todoless${focus ? ` met focus: ${focus}` : ''}. Lees eerst todoless://inbox en todoless://current-run. Stel maximaal 3 taken voor. Vraag bevestiging voordat je commit_to_run gebruikt.`,
      },
    }],
  }));

  return server;
}

export async function startStdio(config = loadConfig()) {
  const server = createTodolessMcpServer(config);
  await server.connect(new StdioServerTransport());
}

export async function startHttp(config = loadConfig()) {
  const httpServer = createServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, readonly: config.readonly }));
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') {
      res.writeHead(405);
      res.end('Method not allowed');
      return;
    }

    try {
      const server = createTodolessMcpServer(config);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      const body = req.method === 'POST' ? await readJsonBody(req) : undefined;
      await transport.handleRequest(req, res, body);
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error('MCP HTTP request failed:', error instanceof Error ? error.message : String(error));
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }));
      }
    }
  });

  httpServer.listen(config.httpPort, '0.0.0.0', () => {
    console.error(`todoless MCP HTTP listening on :${config.httpPort}/mcp readonly=${config.readonly}`);
  });
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : undefined;
}
