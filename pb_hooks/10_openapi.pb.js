/// <reference path="../../pb_data/types.d.ts" />

// OpenAPI 3.0.3 specification for the todoless API
// Served at: GET /api/openapi.json

routerAdd('GET', '/api/openapi.json', (c) => {
  
  // ── Helper: reusable field definitions ──
  
  function entryProps() {
    return {
      id: { type: "string", description: "Record ID" },
      type: { type: "string", enum: ["task", "grocery"], description: "Entry type" },
      title: { type: "string", example: "Buy milk" },
      description: { type: "string", example: "2% organic" },
      status: { type: "string", enum: ["todo", "done", "backlog", "in_progress"], example: "todo" },
      assignee_id: { type: "string", description: "Assigned user ID", nullable: true },
      labels: { type: "array", items: { type: "string" }, example: ["shopping"] },
      shop_id: { type: "string", description: "Shop ID (grocery only)", nullable: true },
      quantity: { type: "integer", description: "Quantity (grocery only)", nullable: true },
      created_by: { type: "string", description: "Creator user ID" },
      completed_by: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    };
  }
  
  function taskProps() {
    return {
      id: { type: "string" },
      title: { type: "string", example: "Fix login bug" },
      status: { type: "string", enum: ["todo", "in_progress", "done", "backlog"], example: "todo" },
      blocked: { type: "boolean", example: false },
      blocked_comment: { type: "string", nullable: true },
      priority: { type: "string", enum: ["urgent", "normal", "low"], example: "normal" },
      horizon: { type: "string", enum: ["week", "month", "3months", "6months", "year"], example: "week" },
      due_date: { type: "string", format: "date", nullable: true },
      repeat_interval: { type: "string", nullable: true, example: "weekly" },
      labels: { type: "array", items: { type: "string" } },
      assigned_to: { type: "string", nullable: true },
      sprint_id: { type: "string", nullable: true },
      is_private: { type: "boolean", default: false },
      archived: { type: "boolean", default: false },
      flag: { type: "boolean", default: false },
      linked_to: { type: "string", nullable: true, description: "Linked entity ID" },
      linked_type: { type: "string", nullable: true, description: "Linked entity type" },
      linked_item_ids: { type: "array", items: { type: "string" } },
      linked_note_ids: { type: "array", items: { type: "string" } },
      user: { type: "string", description: "Creator user ID" },
      completed_at: { type: "string", format: "date-time", nullable: true },
      created: { type: "string", format: "date-time" },
      updated: { type: "string", format: "date-time" },
    };
  }
  
  function itemProps() {
    return {
      id: { type: "string" },
      title: { type: "string", example: "Apples" },
      completed: { type: "boolean", default: false },
      quantity: { type: "integer", default: 1 },
      shop_id: { type: "string", nullable: true },
      priority: { type: "string", nullable: true },
      assigned_to: { type: "string", nullable: true },
      due_date: { type: "string", format: "date", nullable: true },
      labels: { type: "array", items: { type: "string" } },
      is_private: { type: "boolean", default: false },
      user: { type: "string" },
      created: { type: "string", format: "date-time" },
      updated: { type: "string", format: "date-time" },
    };
  }
  
  function calendarProps() {
    return {
      id: { type: "string" },
      title: { type: "string", example: "Team standup" },
      description: { type: "string", nullable: true },
      start_time: { type: "string", format: "date-time" },
      end_time: { type: "string", format: "date-time", nullable: true },
      all_day: { type: "boolean", default: false },
      task_id: { type: "string", nullable: true, description: "Linked task ID" },
      user: { type: "string" },
    };
  }
  
  function labelProps() {
    return {
      id: { type: "string" },
      name: { type: "string", example: "shopping" },
      color: { type: "string", example: "#6366f1" },
      is_private: { type: "boolean", default: false },
      user: { type: "string" },
    };
  }
  
  function shopProps() {
    return {
      id: { type: "string" },
      name: { type: "string", example: "Supermarket" },
      color: { type: "string", example: "#6366f1" },
      user: { type: "string" },
    };
  }
  
  function noteProps() {
    return {
      id: { type: "string" },
      title: { type: "string", nullable: true, example: "Meeting notes" },
      content: { type: "string", example: "# Notes\nAction items..." },
      pinned: { type: "boolean", default: false },
      labels: { type: "array", items: { type: "string" } },
      linked_type: { type: "string", nullable: true },
      linked_to: { type: "string", nullable: true },
      user: { type: "string" },
    };
  }
  
  function userProps() {
    return {
      id: { type: "string" },
      email: { type: "string", format: "email" },
      name: { type: "string" },
      avatar: { type: "string", nullable: true },
      role: { type: "string", enum: ["admin", "user", "assistant", "child"] },
      family_id: { type: "string", nullable: true },
      active: { type: "boolean", default: true },
    };
  }
  
  function familyProps() {
    return {
      id: { type: "string" },
      name: { type: "string", example: "My Family" },
      created_by: { type: "string" },
    };
  }
  
  function goalProps() {
    return {
      id: { type: "string" },
      title: { type: "string", example: "Read 12 books" },
      description: { type: "string", nullable: true },
      points_required: { type: "integer", default: 0 },
      points_current: { type: "integer", default: 0 },
      target_user: { type: "string", nullable: true },
      completed: { type: "boolean", default: false },
      completed_at: { type: "string", format: "date-time", nullable: true },
      user: { type: "string" },
    };
  }
  
  function rewardProps() {
    return {
      id: { type: "string" },
      title: { type: "string", example: "Star sticker" },
      points: { type: "integer", default: 0 },
      earned_by: { type: "string", nullable: true },
      awarded_by: { type: "string" },
      reason: { type: "string", nullable: true },
      task_id: { type: "string", nullable: true },
      earned_at: { type: "string", format: "date-time", nullable: true },
      user: { type: "string" },
    };
  }
  
  function projectProps() {
    return {
      id: { type: "string" },
      title: { type: "string", example: "Home renovation" },
      description: { type: "string", nullable: true },
      color: { type: "string", example: "#6366f1" },
      status: { type: "string", enum: ["active", "completed", "archived"] },
      task_ids: { type: "array", items: { type: "string" } },
      due_date: { type: "string", format: "date", nullable: true },
      user: { type: "string" },
    };
  }
  
  function sprintProps() {
    return {
      id: { type: "string" },
      name: { type: "string", example: "Sprint 5" },
      start_date: { type: "string", format: "date" },
      end_date: { type: "string", format: "date" },
      duration: { type: "string", example: "2weeks" },
      week_number: { type: "integer" },
      year: { type: "integer" },
      user: { type: "string" },
    };
  }
  
  function reminderProps() {
    return {
      id: { type: "string" },
      title: { type: "string", example: "Doctor appointment" },
      message: { type: "string", nullable: true },
      reminder_time: { type: "string", format: "date-time" },
      fired: { type: "boolean", default: false },
      dismissed: { type: "boolean", default: false },
      linked_type: { type: "string", nullable: true },
      linked_to: { type: "string", nullable: true },
      repeat_interval: { type: "string", nullable: true },
      user: { type: "string" },
    };
  }
  
  function inviteProps() {
    return {
      id: { type: "string" },
      code: { type: "string", example: "123456" },
      used: { type: "boolean", default: false },
      used_by: { type: "string", nullable: true },
      used_at: { type: "string", format: "date-time", nullable: true },
      expires_at: { type: "string", format: "date-time" },
      user: { type: "string", description: "Creator user ID" },
    };
  }
  
  function aiConfigProps() {
    return {
      configured: { type: "boolean" },
      provider: { type: "string", example: "openai" },
      api_url: { type: "string", example: "https://api.openai.com/v1" },
      model: { type: "string", example: "gpt-4o-mini" },
      max_tokens: { type: "integer", default: 1024 },
      temperature: { type: "number", default: 0.7 },
      enabled: { type: "boolean", default: true },
    };
  }
  
  // ── Auth helpers ──
  
  function authRequired() {
    return [{ bearerAuth: [] }, { cookieAuth: [] }];
  }
  
  function st() { return { type: "string" }; }
  function sn() { return { type: "string", nullable: true }; }
  function sb() { return { type: "boolean" }; }
  function si() { return { type: "integer" }; }
  function sa(items) { return { type: "array", items: items }; }
  
  // ── Schema builders ──
  
  function registerSchema() {
    return {
      tags: ["Auth"],
      summary: "Register user",
      description: "Creates a new user account. First user becomes admin without invite. Subsequent users require an invite code or bootstrap mode.",
      operationId: "registerUser",
      requestBody: {
        required: true,
        content: { "application/json": { schema: {
          type: "object",
          required: ["email", "password", "passwordConfirm"],
          properties: {
            email: { type: "string", format: "email", example: "user@example.com" },
            password: { type: "string", minLength: 8, example: "securepass123" },
            passwordConfirm: { type: "string", example: "securepass123" },
            name: sn(),
            family_name: sn(),
            invite_code: sn(),
            user_type: { type: "string", enum: ["family_member", "family_assistant"], default: "family_member" },
          },
        } } },
      },
      responses: {
        "201": { description: "User created", content: { "application/json": { schema: { type: "object", properties: { user: { type: "object", properties: { id: st(), email: st(), name: st(), role: st(), family_id: sn() } } } } } } },
        "400": { description: "Validation error", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
      },
    };
  }
  
  function validateInviteSchema() {
    return {
      tags: ["Auth", "Invites"],
      summary: "Validate invite code",
      description: "Public endpoint to check if an invite code is valid.",
      operationId: "validateInvite",
      parameters: [{ name: "code", in: "query", required: true, schema: { type: "string" }, example: "123456" }],
      responses: {
        "200": { description: "Invite status", content: { "application/json": { schema: { type: "object", properties: {
          status: { type: "string", enum: ["valid", "not_found", "used", "expired"] },
          message: st(),
          invite: { type: "object", properties: { id: st(), code: st(), created_by: st(), inviter: { type: "object", properties: { id: st(), name: st() } } } },
        } } } } },
      },
    };
  }
  
  function unifiedApiSchema() {
    return {
      tags: ["Entries"],
      summary: "Unified action dispatcher",
      description: "Single endpoint for all entry (task+grocery) operations: list, create, update, complete, assign, delete, filters, set_role, set_user_block, delete_user.",
      operationId: "unifiedApi",
      requestBody: {
        required: true,
        content: { "application/json": { schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["list", "create", "update", "complete", "assign", "delete", "filters", "set_role", "set_user_block", "delete_user"] },
            type: { type: "string", enum: ["task", "grocery"] },
            id: st(),
            title: st(),
            status: st(),
            description: st(),
            assignee_id: st(),
            labels: sa({ type: "string" }),
            shop_id: st(),
            quantity: si(),
            complete: sb(),
          },
        } } },
      },
      responses: {
        "200": { description: "Success" },
        "201": { description: "Created" },
        "400": { description: "Bad request" },
        "401": { description: "Unauthorized" },
      },
    };
  }
  
  function listEntriesSchema() {
    return {
      tags: ["Entries"],
      summary: "List unified entries",
      description: "Returns all tasks and groceries for the authenticated user's family, with optional filters.",
      operationId: "listEntries",
      parameters: filterParams(),
      security: authRequired(),
      responses: { "200": { description: "List of entries", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/Entry" } } } } } },
    };
  }
  
  function filterParams() {
    return [
      { name: "type", in: "query", schema: { type: "string", enum: ["task", "grocery"] } },
      { name: "status", in: "query", schema: { type: "string" } },
      { name: "assignee_id", in: "query", schema: { type: "string" } },
      { name: "label", in: "query", schema: { type: "string" } },
      { name: "shop_id", in: "query", schema: { type: "string" } },
    ];
  }
  
  function crudGetPost(pathSchema) {
    return pathSchema;
  }
  
  // ── Tasks ──
  
  function listTasksSchema() {
    return {
      tags: ["Tasks"], summary: "List tasks", operationId: "listTasks",
      parameters: [
        { name: "sort", in: "query", schema: { type: "string", default: "-created" } },
        { name: "status", in: "query", schema: { type: "string" } },
      ],
      security: authRequired(),
      responses: { "200": { description: "List of tasks", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/Task" } } } } } },
    };
  }
  
  function createTaskSchema() {
    return {
      tags: ["Tasks"], summary: "Create task", operationId: "createTask",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: taskBodyProps() } } } },
      security: authRequired(),
      responses: { "201": { description: "Task created", content: { "application/json": { schema: { "$ref": "#/components/schemas/Task" } } } } },
    };
  }
  
  function getTaskSchema() {
    return {
      tags: ["Tasks"], summary: "Get task", operationId: "getTask",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      security: authRequired(),
      responses: { "200": { description: "Task", content: { "application/json": { schema: { "$ref": "#/components/schemas/Task" } } } } },
    };
  }
  
  function updateTaskSchema() {
    return {
      tags: ["Tasks"], summary: "Update task", operationId: "updateTask",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: taskBodyProps() } } } },
      security: authRequired(),
      responses: { "200": { description: "Task updated", content: { "application/json": { schema: { "$ref": "#/components/schemas/Task" } } } } },
    };
  }
  
  function deleteTaskSchema() {
    return {
      tags: ["Tasks"], summary: "Delete task", operationId: "deleteTask",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      security: authRequired(),
      responses: { "200": { description: "Deleted", content: { "application/json": { schema: { type: "object", properties: { deleted: { type: "boolean" } } } } } } },
    };
  }
  
  function taskBodyProps() {
    return {
      title: st(), status: st(), blocked: sb(), blocked_comment: sn(),
      priority: st(), horizon: st(), assigned_to: sn(), sprint_id: sn(),
      due_date: sn(), repeat_interval: sn(), completed_at: sn(),
      labels: sa({ type: "string" }), is_private: sb(), archived: sb(),
      flag: sb(), linked_to: sn(), linked_type: sn(),
      linked_item_ids: sa({ type: "string" }), linked_note_ids: sa({ type: "string" }),
    };
  }
  
  // ── Task Actions ──
  
  function archiveTaskSchema() {
    return {
      tags: ["Tasks"], summary: "Archive a task", operationId: "archiveTask",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "retention", in: "query", schema: { type: "integer", default: 30, description: "Days before auto-delete (0 = never)" } },
      ],
      security: authRequired(),
      responses: { "200": { description: "Task archived" } },
    };
  }
  
  function archiveDoneTasksSchema() {
    return {
      tags: ["Tasks"], summary: "Archive all done tasks", operationId: "archiveDoneTasks",
      security: authRequired(),
      responses: { "200": { description: "Bulk archive result", content: { "application/json": { schema: { type: "object", properties: { archived: sa({ type: "string" }), count: si() } } } } } },
    };
  }
  
  function convertTaskToItemSchema() {
    return {
      tags: ["Tasks", "Items"], summary: "Convert task to grocery item", operationId: "convertTaskToItem",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      security: authRequired(),
      responses: { "200": { description: "Converted", content: { "application/json": { schema: { type: "object", properties: { message: st(), item_id: st() } } } } } },
    };
  }
  
  function uncheckAllTasksSchema() {
    return {
      tags: ["Tasks"], summary: "Reset all done tasks to todo", operationId: "uncheckAllTasks",
      security: authRequired(),
      responses: { "200": { description: "Reset result", content: { "application/json": { schema: { type: "object", properties: { updated: sa({ type: "string" }), count: si() } } } } } },
    };
  }
  
  function moveTaskSchema() {
    return {
      tags: ["Tasks"], summary: "Move task status", operationId: "moveTask",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["backlog", "todo", "done"] } } } } } },
      security: authRequired(),
      responses: { "200": { description: "Task moved" } },
    };
  }
  
  // ── Items (Groceries) ──
  
  function listItemsSchema() {
    return {
      tags: ["Items"], summary: "List grocery items", operationId: "listItems",
      parameters: [
        { name: "sort", in: "query", schema: { type: "string", default: "-created" } },
        { name: "completed", in: "query", schema: { type: "string", enum: ["true", "false"] } },
      ],
      security: authRequired(),
      responses: { "200": { description: "List of items", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/Item" } } } } } },
    };
  }
  
  function createItemSchema() {
    return {
      tags: ["Items"], summary: "Create grocery item", operationId: "createItem",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
        title: st(), completed: sb(), quantity: si(), shop_id: sn(),
        priority: sn(), assigned_to: sn(), due_date: sn(),
        labels: sa({ type: "string" }), is_private: sb(),
      } } } } },
      security: authRequired(),
      responses: { "201": { description: "Item created", content: { "application/json": { schema: { "$ref": "#/components/schemas/Item" } } } } },
    };
  }
  
  function getItemSchema() {
    return {
      tags: ["Items"], summary: "Get grocery item", operationId: "getItem",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      security: authRequired(),
      responses: { "200": { description: "Item", content: { "application/json": { schema: { "$ref": "#/components/schemas/Item" } } } } },
    };
  }
  
  function updateItemSchema() {
    return {
      tags: ["Items"], summary: "Update grocery item", operationId: "updateItem",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
        title: st(), completed: sb(), shop_id: sn(), quantity: si(),
        priority: sn(), assigned_to: sn(), due_date: sn(),
        labels: sa({ type: "string" }), is_private: sb(),
      } } } } },
      security: authRequired(),
      responses: { "200": { description: "Item updated", content: { "application/json": { schema: { "$ref": "#/components/schemas/Item" } } } } },
    };
  }
  
  function deleteItemSchema() {
    return {
      tags: ["Items"], summary: "Delete grocery item", operationId: "deleteItem",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      security: authRequired(),
      responses: { "200": { description: "Deleted", content: { "application/json": { schema: { type: "object", properties: { deleted: { type: "boolean" } } } } } } },
    };
  }
  
  function convertItemToTaskSchema() {
    return {
      tags: ["Items", "Tasks"], summary: "Convert item to task", operationId: "convertItemToTask",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      security: authRequired(),
      responses: { "200": { description: "Converted" } },
    };
  }
  
  function uncheckAllItemsSchema() {
    return {
      tags: ["Items"], summary: "Reset all completed items to incomplete", operationId: "uncheckAllItems",
      security: authRequired(),
      responses: { "200": { description: "Reset result" } },
    };
  }
  
  // ── Calendar ──
  
  function listCalendarEventsSchema() {
    return {
      tags: ["Calendar"], summary: "List calendar events", operationId: "listCalendarEvents",
      parameters: [
        { name: "sort", in: "query", schema: { type: "string", default: "start_time" } },
        { name: "start", in: "query", schema: { type: "string", format: "date-time", description: "Filter start time >= start" } },
        { name: "end", in: "query", schema: { type: "string", format: "date-time", description: "Filter end time <= end" } },
      ],
      security: authRequired(),
      responses: { "200": { description: "Calendar events", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/CalendarEvent" } } } } } },
    };
  }
  
  function createCalendarEventSchema() {
    return {
      tags: ["Calendar"], summary: "Create calendar event", operationId: "createCalendarEvent",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
        title: st(), description: sn(), start_time: st(), end_time: sn(), all_day: sb(), task_id: sn(),
      } } } } },
      security: authRequired(),
      responses: { "201": { description: "Event created" } },
    };
  }
  
  function getCalendarEventSchema() {
    return {
      tags: ["Calendar"], summary: "Get calendar event", operationId: "getCalendarEvent",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      security: authRequired(),
      responses: { "200": { description: "Calendar event" } },
    };
  }
  
  function updateCalendarEventSchema() {
    return {
      tags: ["Calendar"], summary: "Update calendar event", operationId: "updateCalendarEvent",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
        title: st(), description: sn(), start_time: sn(), end_time: sn(), all_day: sb(), task_id: sn(),
      } } } } },
      security: authRequired(),
      responses: { "200": { description: "Event updated" } },
    };
  }
  
  function deleteCalendarEventSchema() {
    return {
      tags: ["Calendar"], summary: "Delete calendar event", operationId: "deleteCalendarEvent",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      security: authRequired(),
      responses: { "200": { description: "Deleted" } },
    };
  }
  
  // ── Families ──
  
  function listFamiliesSchema() { return { tags: ["Families"], summary: "List families", operationId: "listFamilies", security: authRequired(), responses: { "200": { description: "Families" } } }; }
  function createFamilySchema() { return { tags: ["Families"], summary: "Create family", operationId: "createFamily", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: st() } } } } }, security: authRequired(), responses: { "201": { description: "Family created" } } }; }
  function getFamilySchema() { return { tags: ["Families"], summary: "Get family", operationId: "getFamily", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Family" } } }; }
  function joinFamilySchema() { return { tags: ["Families"], summary: "Join family", operationId: "joinFamily", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Joined" } } }; }
  function leaveFamilySchema() { return { tags: ["Families"], summary: "Leave family", operationId: "leaveFamily", security: authRequired(), responses: { "200": { description: "Left family" } } }; }
  
  // ── Goals ──
  
  function listGoalsSchema() { return { tags: ["Goals"], summary: "List goals", operationId: "listGoals", parameters: [{ name: "sort", in: "query", schema: { type: "string", default: "-created" } }], security: authRequired(), responses: { "200": { description: "Goals" } } }; }
  function getGoalSchema() { return { tags: ["Goals"], summary: "Get goal", operationId: "getGoal", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Goal" } } }; }
  function createGoalSchema() { return { tags: ["Goals"], summary: "Create goal", operationId: "createGoal", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { title: st(), description: sn(), points_required: si(), target_user: sn() } } } } }, security: authRequired(), responses: { "201": { description: "Goal created" } } }; }
  function updateGoalSchema() { return { tags: ["Goals"], summary: "Update goal", operationId: "updateGoal", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { title: st(), description: sn(), points_required: si(), points_current: si(), target_user: sn(), completed: sb() } } } } }, security: authRequired(), responses: { "200": { description: "Goal updated" } } }; }
  function deleteGoalSchema() { return { tags: ["Goals"], summary: "Delete goal", operationId: "deleteGoal", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } }; }
  
  // ── Invites ──
  
  function listInvitesSchema() { return { tags: ["Invites"], summary: "List invite codes", operationId: "listInvites", parameters: [{ name: "sort", in: "query", schema: { type: "string", default: "-created" } }], security: authRequired(), responses: { "200": { description: "Invites" } } }; }
  function getInviteSchema() { return { tags: ["Invites"], summary: "Get invite code", operationId: "getInvite", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Invite" } } }; }
  function createInviteSchema() { return { tags: ["Invites"], summary: "Create invite code", operationId: "createInvite", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { code: st(), expires_at: sn() } } } } }, security: authRequired(), responses: { "201": { description: "Invite created" } } }; }
  function deleteInviteSchema() { return { tags: ["Invites"], summary: "Delete invite code", operationId: "deleteInvite", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } }; }
  function createInviteServerSideSchema() { return { tags: ["Invites"], summary: "Create invite code (server-side)", operationId: "createInviteServerSide", description: "Generates a unique 6-digit code with 24h expiry via server-side logic.", security: authRequired(), responses: { "201": { description: "Invite created" } } }; }
  function generateInviteSchema() { return { tags: ["Invites"], summary: "Generate random invite code", operationId: "generateInvite", description: "Generates a random 6-digit code with 1h expiry.", security: authRequired(), responses: { "201": { description: "Invite generated" } } }; }
  function useInviteSchema() { return { tags: ["Invites"], summary: "Use/mark invite as used", operationId: "useInvite", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Invite marked used" }, "409": { description: "Already used" }, "410": { description: "Expired" } } }; }
  
  // ── Labels ──
  
  function listLabelsSchema() { return { tags: ["Labels"], summary: "List labels", operationId: "listLabels", parameters: [{ name: "sort", in: "query", schema: { type: "string", default: "name" } }], security: authRequired(), responses: { "200": { description: "Labels" } } }; }
  function getLabelSchema() { return { tags: ["Labels"], summary: "Get label", operationId: "getLabel", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Label" } } }; }
  function createLabelSchema() { return { tags: ["Labels"], summary: "Create label", operationId: "createLabel", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: st(), color: { type: "string", default: "#6366f1" }, is_private: sb() } } } } }, security: authRequired(), responses: { "201": { description: "Label created" } } }; }
  function updateLabelSchema() { return { tags: ["Labels"], summary: "Update label", operationId: "updateLabel", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Label updated" } } }; }
  function deleteLabelSchema() { return { tags: ["Labels"], summary: "Delete label", operationId: "deleteLabel", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } }; }
  
  // ── Notes ──
  
  function listNotesSchema() { return { tags: ["Notes"], summary: "List notes", operationId: "listNotes", parameters: [{ name: "sort", in: "query", schema: { type: "string", default: "-created" } }], security: authRequired(), responses: { "200": { description: "Notes" } } }; }
  function getNoteSchema() { return { tags: ["Notes"], summary: "Get note", operationId: "getNote", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Note" } } }; }
  function createNoteSchema() { return { tags: ["Notes"], summary: "Create note", operationId: "createNote", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { title: sn(), content: st(), pinned: sb(), labels: sa({ type: "string" }), linked_type: sn(), linked_to: sn() } } } } }, security: authRequired(), responses: { "201": { description: "Note created" } } }; }
  function updateNoteSchema() { return { tags: ["Notes"], summary: "Update note", operationId: "updateNote", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Note updated" } } }; }
  function deleteNoteSchema() { return { tags: ["Notes"], summary: "Delete note", operationId: "deleteNote", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } }; }
  
  // ── Paperless ──
  
  function paperlessWebhookSchema() { return { tags: ["Paperless"], summary: "Paperless webhook handler", operationId: "paperlessWebhook", description: "Receives Paperless-ngx document creation webhooks. Validates secret via X-Paperless-Webhook-Secret or Authorization header. Creates a task for documents tagged 'todo'.", security: [], responses: { "201": { description: "Task created" }, "401": { description: "Invalid secret" }, "400": { description: "Missing document_id" } } }; }
  function paperlessPollSchema() { return { tags: ["Paperless"], summary: "Poll Paperless for new docs", operationId: "paperlessPoll", description: "Fetches unprocessed documents from Paperless with the configured todo tag.", security: authRequired(), responses: { "200": { description: "Documents list" } } }; }
  function paperlessTestSchema() { return { tags: ["Paperless"], summary: "Test Paperless connection", operationId: "paperlessTest", security: authRequired(), responses: { "200": { description: "Connection status" } } }; }
  function paperlessConfigSchema() { return { tags: ["Paperless"], summary: "Configure Paperless integration", operationId: "paperlessConfig", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { api_url: st(), api_key: st(), todo_tag: { type: "string", default: "todo" }, enabled: sb() } } } } }, security: authRequired(), responses: { "200": { description: "Updated" }, "201": { description: "Created" } } }; }
  function paperlessSyncSchema() { return { tags: ["Paperless"], summary: "Manual sync Paperless documents", operationId: "paperlessSync", description: "Triggers a full sync: scans recent Paperless docs with todo tag and creates tasks.", security: authRequired(), responses: { "200": { description: "Sync result" } } }; }
  
  // ── Projects ──
  
  function listProjectsSchema() { return { tags: ["Projects"], summary: "List projects", operationId: "listProjects", parameters: [{ name: "sort", in: "query", schema: { type: "string", default: "-created" } }, { name: "status", in: "query", schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Projects" } } }; }
  function getProjectSchema() { return { tags: ["Projects"], summary: "Get project", operationId: "getProject", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Project" } } }; }
  function createProjectSchema() { return { tags: ["Projects"], summary: "Create project", operationId: "createProject", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { title: st(), description: sn(), color: st(), status: st(), task_ids: sa({ type: "string" }), due_date: sn() } } } } }, security: authRequired(), responses: { "201": { description: "Project created" } } }; }
  function updateProjectSchema() { return { tags: ["Projects"], summary: "Update project", operationId: "updateProject", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Project updated" } } }; }
  function deleteProjectSchema() { return { tags: ["Projects"], summary: "Delete project", operationId: "deleteProject", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } }; }
  
  // ── Reminders ──
  
  function listRemindersSchema() { return { tags: ["Reminders"], summary: "List reminders", operationId: "listReminders", parameters: [
    { name: "sort", in: "query", schema: { type: "string", default: "reminder_time" } },
    { name: "include_fired", in: "query", schema: { type: "string", enum: ["true"], description: "Include fired/dismissed reminders" } },
  ], security: authRequired(), responses: { "200": { description: "Reminders" } } }; }
  function createReminderSchema() { return { tags: ["Reminders"], summary: "Create reminder", operationId: "createReminder", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { title: st(), message: sn(), reminder_time: st(), linked_type: sn(), linked_to: sn(), repeat_interval: sn() } } } } }, security: authRequired(), responses: { "201": { description: "Reminder created" } } }; }
  function updateReminderSchema() { return { tags: ["Reminders"], summary: "Update reminder", operationId: "updateReminder", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Reminder updated" } } }; }
  function deleteReminderSchema() { return { tags: ["Reminders"], summary: "Delete reminder", operationId: "deleteReminder", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } }; }
  
  // ── Rewards ──
  
  function listRewardsSchema() { return { tags: ["Rewards"], summary: "List rewards", operationId: "listRewards", security: authRequired(), responses: { "200": { description: "Rewards" } } }; }
  function getRewardSchema() { return { tags: ["Rewards"], summary: "Get reward", operationId: "getReward", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Reward" } } }; }
  function createRewardSchema() { return { tags: ["Rewards"], summary: "Create reward", operationId: "createReward", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { title: st(), points: si(), earned_by: sn(), reason: sn(), task_id: sn() } } } } }, security: authRequired(), responses: { "201": { description: "Reward created" } } }; }
  function deleteRewardSchema() { return { tags: ["Rewards"], summary: "Delete reward", operationId: "deleteReward", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } }; }
  
  // ── Settings ──
  
  function getSettingsSchema() { return { tags: ["Settings"], summary: "Get user settings", operationId: "getSettings", security: authRequired(), responses: { "200": { description: "Settings" } } }; }
  function updateSettingsSchema() { return { tags: ["Settings"], summary: "Update user settings", operationId: "updateSettings", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { sprint_duration: st(), sprint_start_day: si(), language: st(), archive_retention_days: si(), auto_cleanup: sb(), theme: st(), setup_complete: sb() } } } } }, security: authRequired(), responses: { "200": { description: "Settings updated" } } }; }
  
  // ── Shared Views ──
  
  function sharedTasksSchema() { return { tags: ["Shared"], summary: "List shared (non-private) tasks", operationId: "sharedTasks", security: authRequired(), responses: { "200": { description: "Shared tasks" } } }; }
  function sharedItemsSchema() { return { tags: ["Shared"], summary: "List shared (non-private) items", operationId: "sharedItems", security: authRequired(), responses: { "200": { description: "Shared items" } } }; }
  function sharedNotesSchema() { return { tags: ["Shared"], summary: "List shared (non-private) notes", operationId: "sharedNotes", security: authRequired(), responses: { "200": { description: "Shared notes" } } }; }
  
  // ── Shops ──
  
  function listShopsSchema() { return { tags: ["Shops"], summary: "List shops", operationId: "listShops", security: authRequired(), responses: { "200": { description: "Shops" } } }; }
  function getShopSchema() { return { tags: ["Shops"], summary: "Get shop", operationId: "getShop", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Shop" } } }; }
  function createShopSchema() { return { tags: ["Shops"], summary: "Create shop", operationId: "createShop", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: st(), color: { type: "string", default: "#6366f1" } } } } } }, security: authRequired(), responses: { "201": { description: "Shop created" } } }; }
  function updateShopSchema() { return { tags: ["Shops"], summary: "Update shop", operationId: "updateShop", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Shop updated" } } }; }
  function deleteShopSchema() { return { tags: ["Shops"], summary: "Delete shop", operationId: "deleteShop", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } }; }
  
  // ── Sprints ──
  
  function listSprintsSchema() { return { tags: ["Sprints"], summary: "List sprints", operationId: "listSprints", parameters: [{ name: "sort", in: "query", schema: { type: "string", default: "-start_date" } }], security: authRequired(), responses: { "200": { description: "Sprints" } } }; }
  function getSprintSchema() { return { tags: ["Sprints"], summary: "Get sprint", operationId: "getSprint", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Sprint" } } }; }
  function createSprintSchema() { return { tags: ["Sprints"], summary: "Create sprint", operationId: "createSprint", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: st(), duration: st(), start_date: sn(), end_date: sn() } } } } }, security: authRequired(), responses: { "201": { description: "Sprint created" } } }; }
  function updateSprintSchema() { return { tags: ["Sprints"], summary: "Update sprint", operationId: "updateSprint", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Sprint updated" } } }; }
  function deleteSprintSchema() { return { tags: ["Sprints"], summary: "Delete sprint", operationId: "deleteSprint", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } }; }
  function newSprintSchema() { return { tags: ["Sprints"], summary: "Create new sprint from settings", operationId: "newSprint", description: "Creates a new sprint based on user's sprint_duration and sprint_start_day settings.", security: authRequired(), responses: { "201": { description: "Sprint created" } } }; }
  function archiveSprintTasksSchema() { return { tags: ["Sprints"], summary: "Archive all done tasks in sprint", operationId: "archiveSprintTasks", security: authRequired(), responses: { "200": { description: "Archived" } } }; }
  
  // ── Users ──
  
  function listUsersSchema() { return { tags: ["Users"], summary: "List users", operationId: "listUsers", security: authRequired(), responses: { "200": { description: "Users list" } } }; }
  function getUserSchema() { return { tags: ["Users"], summary: "Get user", operationId: "getUser", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "User" } } }; }
  function updateUserSchema() { return { tags: ["Users"], summary: "Update user", operationId: "updateUser", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: st(), avatar: sn(), role: st(), family_id: sn(), password: st() } } } } }, security: authRequired(), responses: { "200": { description: "User updated" } } }; }
  
  // ── AI ──
  
  function getAiConfigSchema() { return { tags: ["AI"], summary: "Get AI config", operationId: "getAiConfig", security: authRequired(), responses: { "200": { description: "AI config", content: { "application/json": { schema: { "$ref": "#/components/schemas/AiConfig" } } } } } }; }
  function configureAiSchema() { return { tags: ["AI"], summary: "Configure AI assistant", operationId: "configureAi", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { provider: st(), api_url: st(), api_key: st(), model: st(), max_tokens: si(), temperature: { type: "number" }, enabled: sb() } } } } }, security: authRequired(), responses: { "200": { description: "Updated" }, "201": { description: "Created" } } }; }
  function aiCategorizeSchema() { return { tags: ["AI"], summary: "Categorize a task using AI", operationId: "aiCategorize", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { title: st(), description: sn() } } } } }, security: authRequired(), responses: { "200": { description: "Categorization result" } } }; }
  function aiSuggestSchema() { return { tags: ["AI"], summary: "Get task suggestions from AI", operationId: "aiSuggest", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { context: sn(), count: si() } } } } }, security: authRequired(), responses: { "200": { description: "Suggestions" } } }; }
  function aiChatSchema() { return { tags: ["AI"], summary: "Chat with AI about tasks", operationId: "aiChat", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { message: st() } } } } }, security: authRequired(), responses: { "200": { description: "AI response" } } } };
  
  // ── External References ──
  
  function listExternalRefsSchema() { return { tags: ["External References"], summary: "List external references", operationId: "listExternalRefs", description: "List external system links (Paperless, Home Assistant, Gmail, custom). Filters: source, sync_status, entity_type.", parameters: [
    { name: "source", in: "query", schema: { type: "string" } },
    { name: "sync_status", in: "query", schema: { type: "string", enum: ["synced", "pending", "error", "orphaned"] } },
    { name: "entity_type", in: "query", schema: { type: "string", enum: ["task", "grocery", "note"] } },
    { name: "sort", in: "query", schema: { type: "string", default: "-created" } },
  ], security: authRequired(), responses: { "200": { description: "List of external references" } } }; }
  function createExternalRefSchema() { return { tags: ["External References"], summary: "Create external reference", operationId: "createExternalRef", description: "Links a todoless entity to an external system entity. Checks for duplicate (source + external_id).", requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
    source: { type: "string", enum: ["paperless", "home_assistant", "gmail", "custom"] },
    external_id: st(), external_url: sn(),
    entity_type: { type: "string", enum: ["task", "grocery", "note"] },
    entity_id: st(), sync_status: { type: "string", default: "pending" },
    last_synced_at: sn(),
  }, required: ["source", "external_id", "entity_type", "entity_id"] } } } }, security: authRequired(), responses: { "201": { description: "External reference created" }, "409": { description: "Duplicate reference exists" } } }; }
  function getExternalRefSchema() { return { tags: ["External References"], summary: "Get external reference", operationId: "getExternalRef", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "External reference" } } }; }
  function updateExternalRefSchema() { return { tags: ["External References"], summary: "Update external reference", operationId: "updateExternalRef", description: "Update sync state, URL, or linked entity. Primary use: update sync_status after integration completes.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: {
    sync_status: { type: "string", enum: ["synced", "pending", "error", "orphaned"] },
    last_synced_at: sn(), external_url: sn(), entity_type: sn(), entity_id: sn(),
  } } } } }, security: authRequired(), responses: { "200": { description: "External reference updated" } } }; }
  
  // ── Agent Token & Permissions ──
  
  function createAgentTokenSchema() {
    return {
      tags: ["Agents"],
      summary: "Create agent API token",
      description: "Creates a scoped API token for an external AI agent. Tokens grant specific permissions (tasks:read, tasks:write, groceries:read, etc.) and optionally link to a specific agent user. The raw token is only returned once — save it immediately.",
      operationId: "createAgentToken",
      requestBody: {
        required: true,
        content: { "application/json": { schema: {
          type: "object",
          required: ["name", "permissions"],
          properties: {
            name: { type: "string", example: "henry-assistant", description: "Human-readable token name" },
            permissions: { type: "array", items: { type: "string", enum: ["tasks:read", "tasks:write", "tasks:delete", "groceries:read", "groceries:write", "groceries:delete", "calendar:read", "calendar:write", "tasks:*", "groceries:*", "calendar:*", "*"] }, example: ["tasks:read", "tasks:write", "groceries:read"], description: "Permission scopes to grant" },
            expires_at: { type: "string", format: "date-time", nullable: true, example: "2025-12-31T23:59:59Z", description: "Optional expiry timestamp" },
            agent_id: { type: "string", nullable: true, example: "abc123", description: "Optional agent user ID to associate this token with" },
          },
        } } },
      },
      security: authRequired(),
      responses: {
        "201": { description: "Token created", content: { "application/json": { schema: { type: "object", properties: { id: st(), name: st(), token: st(), permissions: sa({ type: "string" }), enabled: sb(), expires_at: sn(), user: st(), role: st(), created: st(), message: st() } } } } },
        "400": { description: "Validation error", content: { "application/json": { schema: { "$ref": "#/components/schemas/Error" } } } },
        "401": { description: "Unauthorized" },
      },
    };
  }
  
  function listAgentPermissionsSchema() {
    return {
      tags: ["Agents"],
      summary: "List available agent permissions",
      description: "Returns the list of all available permission scopes that can be granted to an agent API token. Public endpoint — no authentication required.",
      operationId: "listAgentPermissions",
      security: [],
      responses: {
        "200": { description: "Available permissions", content: { "application/json": { schema: { type: "object", properties: {
          permissions: { type: "array", items: { type: "string" }, description: "Flat list of all available permission keys" },
          categories: { type: "object", description: "Permissions grouped by resource category with labels and descriptions" },
          wildcards: { type: "array", items: { type: "object", properties: { key: st(), label: st(), description: st() } } },
          description: { type: "string" },
        } } } } },
      },
    };
  }
  function deleteExternalRefSchema() { return { tags: ["External References"], summary: "Delete external reference", operationId: "deleteExternalRef", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], security: authRequired(), responses: { "200": { description: "Deleted" } } } };
  
  var spec = {
    openapi: "3.0.3",
    info: {
      title: "todoless API",
      version: "1.0.0",
      description: "todoless — self-hosted multi-user task and grocery manager.\n\nBase URL: https://[host]:7070/api\n\nAuthentication: PocketBase JWT token via Authorization: Bearer header or PB cookie.",
      contact: { name: "todoless" },
    },
    servers: [
      { url: "/api", description: "Nginx proxy (port 7070)" },
      { url: "http://localhost:8090/api", description: "Direct PocketBase (dev)" },
    ],
    tags: [
      { name: "System", description: "Health check, setup status, OpenAPI spec" },
      { name: "Auth", description: "Authentication and registration" },
      { name: "Invites", description: "Invite code management" },
      { name: "Entries", description: "Unified entries (tasks + groceries)" },
      { name: "Tasks", description: "Task CRUD and actions" },
      { name: "Items", description: "Grocery items CRUD and actions" },
      { name: "Calendar", description: "Calendar events" },
      { name: "Families", description: "Family management (multi-user)" },
      { name: "Goals", description: "Goals/rewards points tracking" },
      { name: "Labels", description: "Label/tag management" },
      { name: "Notes", description: "Notes" },
      { name: "Paperless", description: "Paperless-ngx integration" },
      { name: "Projects", description: "Project management" },
      { name: "Reminders", description: "Reminders" },
      { name: "Rewards", description: "Rewards/awards" },
      { name: "Settings", description: "User settings" },
      { name: "Shared", description: "Shared cross-user views" },
      { name: "Shops", description: "Shop management (grocery)" },
      { name: "Sprints", description: "Sprint management" },
      { name: "Users", description: "User management" },
      { name: "AI", description: "AI assistant integration" },
      { name: "External References", description: "External system link management (Paperless, Home Assistant, Gmail, custom)" },
      { name: "Agents", description: "Agent API tokens and scoped permissions for external AI agents" },
    ],
    paths: {
      // ── System ──
      "/todoless/hook-health": {
        get: {
          tags: ["System"],
          summary: "Health check",
          description: "Returns { ok: true } if the hooks are alive. No auth required.",
          operationId: "hookHealth",
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: true } } } } } },
          },
        },
      },
      "/todoless/setup-status": {
        get: {
          tags: ["System", "Auth"],
          summary: "Setup status",
          description: "Public endpoint returning bootstrap status for first-run onboarding detection.",
          operationId: "setupStatus",
          responses: {
            "200": {
              description: "Setup status",
              content: { "application/json": { schema: { type: "object", properties: { has_users: { type: "boolean" }, setup_complete: { type: "boolean" } }, example: { has_users: false, setup_complete: false } } } },
            },
          },
        },
      },
      "/todoless/openapi.json": {
        get: {
          tags: ["System"],
          summary: "OpenAPI spec",
          description: "Returns this OpenAPI specification document.",
          operationId: "getOpenApiSpec",
          responses: { "200": { description: "OpenAPI spec" } },
        },
      },
      "/todoless/docs": {
        get: {
          tags: ["System"],
          summary: "Swagger UI",
          description: "Swagger UI HTML page for interactive API exploration.",
          operationId: "getSwaggerUi",
          responses: { "200": { description: "Swagger UI HTML page" } },
        },
      },

      // ── Auth & Registration ──
      "/todoless/register": {
        post: registerSchema(),
      },
      "/todoless/validate-invite": {
        get: validateInviteSchema(),
      },

      // ── Unified API v2 ──
      "/todoless/api": {
        post: unifiedApiSchema(),
      },

      // ── Entries ──
      "/todoless/entries": {
        get: listEntriesSchema(),
      },

      // ── Tasks CRUD ──
      "/todoless/tasks": {
        get: listTasksSchema(),
        post: createTaskSchema(),
      },
      "/todoless/tasks/{id}": {
        get: getTaskSchema(),
        patch: updateTaskSchema(),
        delete: deleteTaskSchema(),
      },

      // ── Task Actions ──
      "/todoless/tasks/{id}/archive": { post: archiveTaskSchema() },
      "/todoless/tasks/archive-done": { post: archiveDoneTasksSchema() },
      "/todoless/tasks/{id}/convert-to-item": { post: convertTaskToItemSchema() },
      "/todoless/tasks/uncheck-all-done": { post: uncheckAllTasksSchema() },
      "/todoless/tasks/{id}/move": { post: moveTaskSchema() },

      // ── Items CRUD ──
      "/todoless/items": {
        get: listItemsSchema(),
        post: createItemSchema(),
      },
      "/todoless/items/{id}": {
        get: getItemSchema(),
        patch: updateItemSchema(),
        delete: deleteItemSchema(),
      },
      "/todoless/items/{id}/convert-to-task": { post: convertItemToTaskSchema() },
      "/todoless/items/uncheck-all-done": { post: uncheckAllItemsSchema() },

      // ── Calendar ──
      "/todoless/calendar": {
        get: listCalendarEventsSchema(),
        post: createCalendarEventSchema(),
      },
      "/todoless/calendar/{id}": {
        get: getCalendarEventSchema(),
        patch: updateCalendarEventSchema(),
        delete: deleteCalendarEventSchema(),
      },

      // ── Families ──
      "/todoless/families": {
        get: listFamiliesSchema(),
        post: createFamilySchema(),
      },
      "/todoless/families/{id}": { get: getFamilySchema() },
      "/todoless/families/join/{id}": { post: joinFamilySchema() },
      "/todoless/families/leave": { post: leaveFamilySchema() },

      // ── Goals ──
      "/todoless/goals": {
        get: listGoalsSchema(),
        post: createGoalSchema(),
      },
      "/todoless/goals/{id}": {
        get: getGoalSchema(),
        patch: updateGoalSchema(),
        delete: deleteGoalSchema(),
      },

      // ── Invites ──
      "/todoless/invites": {
        get: listInvitesSchema(),
        post: createInviteSchema(),
      },
      "/todoless/invites/{id}": {
        get: getInviteSchema(),
        delete: deleteInviteSchema(),
      },
      "/todoless/invites/create": { post: createInviteServerSideSchema() },
      "/todoless/invites/generate": { post: generateInviteSchema() },
      "/todoless/invites/{id}/use": { post: useInviteSchema() },

      // ── Labels ──
      "/todoless/labels": {
        get: listLabelsSchema(),
        post: createLabelSchema(),
      },
      "/todoless/labels/{id}": {
        get: getLabelSchema(),
        patch: updateLabelSchema(),
        delete: deleteLabelSchema(),
      },

      // ── Notes ──
      "/todoless/notes": {
        get: listNotesSchema(),
        post: createNoteSchema(),
      },
      "/todoless/notes/{id}": {
        get: getNoteSchema(),
        patch: updateNoteSchema(),
        delete: deleteNoteSchema(),
      },

      // ── Paperless ──
      "/integrations/paperless/webhook": { post: paperlessWebhookSchema() },
      "/integrations/paperless/poll": { get: paperlessPollSchema() },
      "/integrations/paperless/test": { get: paperlessTestSchema() },
      "/integrations/paperless/config": { post: paperlessConfigSchema() },
      "/integrations/paperless/sync": { post: paperlessSyncSchema() },

      // ── Projects ──
      "/todoless/projects": {
        get: listProjectsSchema(),
        post: createProjectSchema(),
      },
      "/todoless/projects/{id}": {
        get: getProjectSchema(),
        patch: updateProjectSchema(),
        delete: deleteProjectSchema(),
      },

      // ── Reminders ──
      "/todoless/reminders": {
        get: listRemindersSchema(),
        post: createReminderSchema(),
      },
      "/todoless/reminders/{id}": {
        patch: updateReminderSchema(),
        delete: deleteReminderSchema(),
      },

      // ── Rewards ──
      "/todoless/rewards": {
        get: listRewardsSchema(),
        post: createRewardSchema(),
      },
      "/todoless/rewards/{id}": {
        get: getRewardSchema(),
        delete: deleteRewardSchema(),
      },

      // ── Settings ──
      "/todoless/settings": {
        get: getSettingsSchema(),
        patch: updateSettingsSchema(),
      },

      // ── Shared Views ──
      "/todoless/shared/tasks": { get: sharedTasksSchema() },
      "/todoless/shared/items": { get: sharedItemsSchema() },
      "/todoless/shared/notes": { get: sharedNotesSchema() },

      // ── Shops ──
      "/todoless/shops": {
        get: listShopsSchema(),
        post: createShopSchema(),
      },
      "/todoless/shops/{id}": {
        get: getShopSchema(),
        patch: updateShopSchema(),
        delete: deleteShopSchema(),
      },

      // ── Sprints ──
      "/todoless/sprints": {
        get: listSprintsSchema(),
        post: createSprintSchema(),
      },
      "/todoless/sprints/{id}": {
        get: getSprintSchema(),
        patch: updateSprintSchema(),
        delete: deleteSprintSchema(),
      },
      "/todoless/sprints/new": { post: newSprintSchema() },
      "/todoless/sprints/{id}/archive-tasks": { post: archiveSprintTasksSchema() },

      // ── Users ──
      "/todoless/users": { get: listUsersSchema() },
      "/todoless/users/{id}": {
        get: getUserSchema(),
        patch: updateUserSchema(),
      },

      // ── AI ──
      "/todoless/ai/config": {
        get: getAiConfigSchema(),
        post: configureAiSchema(),
      },
      "/todoless/ai/categorize": { post: aiCategorizeSchema() },
      "/todoless/ai/suggest": { post: aiSuggestSchema() },
      "/todoless/ai/chat": { post: aiChatSchema() },

      // ── External References ──
      "/todoless/external-references": {
        get: listExternalRefsSchema(),
        post: createExternalRefSchema(),
      },
      "/todoless/external-references/{id}": {
        get: getExternalRefSchema(),
        patch: updateExternalRefSchema(),
        delete: deleteExternalRefSchema(),
      },

      // ── Agent Token & Permissions ──
      "/todoless/agent/token": {
        post: createAgentTokenSchema(),
      },
      "/todoless/agent/permissions": {
        get: listAgentPermissionsSchema(),
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "PocketBase JWT token from auth-with-password or auth-refresh.",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "pb_token",
          description: "PocketBase auth cookie (set after login).",
        },
      },
      schemas: {
        Error: { type: "object", required: ["error"], properties: { error: { type: "string", example: "Unauthorized" } } },
        Entry: { type: "object", properties: entryProps() },
        Task: { type: "object", properties: taskProps() },
        Item: { type: "object", properties: itemProps() },
        CalendarEvent: { type: "object", properties: calendarProps() },
        Label: { type: "object", properties: labelProps() },
        Shop: { type: "object", properties: shopProps() },
        Note: { type: "object", properties: noteProps() },
        User: { type: "object", properties: userProps() },
        Family: { type: "object", properties: familyProps() },
        Goal: { type: "object", properties: goalProps() },
        Reward: { type: "object", properties: rewardProps() },
        Project: { type: "object", properties: projectProps() },
        Sprint: { type: "object", properties: sprintProps() },
        Reminder: { type: "object", properties: reminderProps() },
        Invite: { type: "object", properties: inviteProps() },
        AiConfig: { type: "object", properties: aiConfigProps() },
        Filters: { type: "object", properties: { labels: { type: "array", items: { "$ref": "#/components/schemas/Label" } }, shops: { type: "array", items: { "$ref": "#/components/schemas/Shop" } }, users: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, role: { type: "string" }, active: { type: "boolean" } } } } } },
      },
    },
    security: [
      { bearerAuth: [] },
      { cookieAuth: [] },
    ],
  };

  return c.json(200, spec);
});
