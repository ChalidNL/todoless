import swaggerJSDoc from 'swagger-jsdoc'

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'TodoLess API',
    version: '0.0.55',
    description: 'Smart todo manager API with labels, workflows, and real-time sync',
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
            type: 'string',
            description: 'Note UUID',
          },
          content: {
            type: 'string',
            description: 'Note content',
          },
          userId: {
            type: 'integer',
            description: 'User ID who owns this note',
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
