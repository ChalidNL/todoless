import swaggerJSDoc from 'swagger-jsdoc'

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'TodoLess API',
    version: '0.0.57',
    description: `Smart todo manager API with labels, workflows, notes, and real-time sync.

**Features:**
- Full CRUD operations for tasks, labels, workflows, notes
- Export/backup functionality (JSON, CSV, full backup)
- Real-time sync via Server-Sent Events (tasks, labels, notes)
- Notes persistence with version tracking and conflict resolution
- Privacy controls (shared/private items)
- API token authentication for programmatic access
- Family workspace support with role-based access
- Advanced search with complex filters

**Authentication:**
- Cookie-based JWT tokens for web sessions
- Bearer token (tdl_...) for API access
- 2FA support for enhanced security

**Base URL:** Production uses nginx proxy at /api, development uses http://localhost:4000`,
    contact: {
      name: 'TodoLess',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Development server',
    },
    {
      url: '/api',
      description: 'Production API (proxied)',
    },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'token',
        description: 'JWT token stored in httpOnly cookie',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Token',
        description: 'API token for programmatic access (format: tdl_...)',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error code or message',
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'User ID',
          },
          username: {
            type: 'string',
            description: 'Username',
          },
          email: {
            type: 'string',
            description: 'Email address',
          },
          role: {
            type: 'string',
            enum: ['adult', 'child'],
            description: 'User role in family workspace',
          },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Task UUID',
          },
          title: {
            type: 'string',
            description: 'Task title',
          },
          notes: {
            type: 'string',
            nullable: true,
            description: 'Task notes/description',
          },
          completed: {
            type: 'boolean',
            description: 'Completion status',
          },
          labelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Label IDs assigned to this task',
          },
          dueDate: {
            type: 'string',
            nullable: true,
            description: 'Due date (YYYY-MM-DD)',
          },
          userId: {
            type: 'integer',
            description: 'User ID who owns this task',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Label: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Label UUID',
          },
          name: {
            type: 'string',
            description: 'Label name',
          },
          color: {
            type: 'string',
            description: 'Label color (hex code)',
          },
          icon: {
            type: 'string',
            nullable: true,
            description: 'Label icon name',
          },
          userId: {
            type: 'integer',
            description: 'User ID who owns this label',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Note: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Note ID',
          },
          title: {
            type: 'string',
            description: 'Note title',
          },
          content: {
            type: 'string',
            nullable: true,
            description: 'Note content',
          },
          labels: {
            type: 'string',
            nullable: true,
            description: 'JSON array of label IDs',
          },
          pinned: {
            type: 'integer',
            description: 'Whether note is pinned (0 or 1)',
          },
          archived: {
            type: 'integer',
            description: 'Whether note is archived (0 or 1)',
          },
          shared: {
            type: 'integer',
            description: 'Whether note is shared (0 or 1)',
          },
          owner_id: {
            type: 'integer',
            description: 'User ID who owns this note',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
          },
          client_id: {
            type: 'string',
            nullable: true,
            description: 'Client-generated ID for deduplication during sync',
          },
          version: {
            type: 'integer',
            description: 'Version number for conflict resolution',
          },
        },
      },
      Workflow: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            description: 'Workflow ID',
          },
          name: {
            type: 'string',
            description: 'Workflow name',
          },
          stages: {
            type: 'string',
            description: 'JSON array of stage names',
            example: '["Backlog","Todo","In Progress","Done"]',
          },
          checkbox_only: {
            type: 'integer',
            description: 'Whether workflow uses checkboxes only (0 or 1)',
          },
          owner_id: {
            type: 'integer',
            description: 'User ID who owns this workflow',
          },
          shared: {
            type: 'integer',
            description: 'Whether workflow is shared (0 or 1)',
          },
          is_default: {
            type: 'integer',
            description: 'Whether this is the default workflow (0 or 1)',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      SavedFilter: {
        type: 'object',
        description: 'v0.0.57: Rebuilt to match Labels architecture exactly',
        properties: {
          id: {
            type: 'integer',
            description: 'Saved filter ID (auto-incremented)',
          },
          name: {
            type: 'string',
            description: 'Filter name',
          },
          normalized_name: {
            type: 'string',
            description: 'Normalized filter name for deduplication',
          },
          query_json: {
            type: 'string',
            description: 'JSON string containing filter query rules (labels, assignees, completion, etc.)',
          },
          menu_visible: {
            type: 'integer',
            description: 'Whether filter is visible in menu (0 or 1) - unique to filters',
          },
          shared: {
            type: 'integer',
            description: 'Whether filter is shared with family workspace (0 or 1)',
          },
          owner_id: {
            type: 'integer',
            description: 'User ID who owns this filter',
          },
          created_at: {
            type: 'string',
            format: 'date-time',
          },
          updated_at: {
            type: 'string',
            format: 'date-time',
          },
          version: {
            type: 'integer',
            description: 'Version number for conflict resolution and sync',
          },
        },
      },
    },
  },
  security: [
    {
      cookieAuth: [],
    },
    {
      bearerAuth: [],
    },
  ],
}

const options = {
  swaggerDefinition,
  apis: ['./src/**/*.ts'], // Path to API route files with JSDoc comments
}

export const swaggerSpec = swaggerJSDoc(options)
