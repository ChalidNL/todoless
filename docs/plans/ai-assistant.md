# AI Assistant Integration

## Overview

Todoless includes an AI assistant that provides task suggestions, auto-categorization, and conversational task help. All AI features are accessed via REST endpoints and require user authentication.

## Configuration

### Setting up AI Provider

Configure your AI provider through the API:

```bash
POST /api/todoless/ai/config
```

Request body (form data):
- `provider`: One of `openai`, `openrouter`, `ollama`, `custom`
- `api_url`: Base URL of the AI provider (e.g., `https://api.openai.com`)
- `api_key`: Your API key (optional for Ollama)
- `model`: Model name (e.g., `gpt-4o-mini`, `llama3`)
- `max_tokens`: Maximum response tokens (default: 1024)
- `temperature`: Response randomness (default: 0.7)
- `enabled`: Enable/disable AI features (default: true)

### Supported Providers

| Provider | Example URL | Notes |
|----------|-------------|-------|
| OpenAI | `https://api.openai.com` | Default, requires API key |
| OpenRouter | `https://openrouter.ai/api` | Access to many models |
| Ollama | `http://localhost:11434` | Local, no API key needed |
| Custom | Any OpenAI-compatible | Self-hosted endpoints |

## API Endpoints

### Categorize Task

Auto-categorize a task with labels, priority, and horizon.

```bash
POST /api/todoless/ai/categorize
Content-Type: application/json

{
  "title": "Buy groceries for the week",
  "description": "Need milk, eggs, bread, and vegetables"
}
```

Response:
```json
{
  "labels": ["shopping", "household"],
  "priority": "normal",
  "horizon": "week",
  "confidence": 0.85
}
```

### Get Task Suggestions

Get AI-generated task suggestions based on context and existing tasks.

```bash
POST /api/todoless/ai/suggest
Content-Type: application/json

{
  "context": "planning my work week",
  "count": 5
}
```

Response:
```json
{
  "suggestions": [
    {
      "title": "Review sprint backlog",
      "labels": ["work", "planning"],
      "priority": "normal",
      "horizon": "week",
      "reason": "Start of week planning"
    }
  ]
}
```

### AI Chat

Chat with the AI about your tasks. It has context about your recent and overdue tasks.

```bash
POST /api/todoless/ai/chat
Content-Type: application/json

{
  "message": "What should I focus on today?"
}
```

Response:
```json
{
  "response": "Based on your tasks, you should focus on..."
}
```

## Security

- All AI endpoints require authentication
- API keys are stored encrypted in the database
- AI responses are parsed as JSON with strict validation
- Invalid AI responses return 502 errors rather than crashing

## Implementation Notes

- Migration: `pb_migrations/015_ai_settings.js` creates the `ai_settings` collection
- Routes: `pb_hooks/routes/ai.js` contains all AI endpoints
- URL normalization automatically appends `/v1/chat/completions` to base URLs
- The system prompt enforces JSON-only responses for categorization and suggestions
