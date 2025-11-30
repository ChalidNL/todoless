export interface User {
  id: string
  name: string
  themeColor: string
  email?: string
  avatar?: string
  username?: string
  firstName?: string
  lastName?: string
  role?: 'admin' | 'user'
  ageGroup?: 'adult' | 'minor'
  points?: number
}

export interface Label {
  id: string
  name: string
  color: string
  shared: boolean
  workflowId?: string
  ownerId?: string
}

export interface Workflow {
  id: string
  name: string
  stages: string[]
  basedOn?: 'label' | 'attribute'
  labelIds?: string[]
  checkboxOnly?: boolean
  isDefault?: boolean
  hideBacklog?: boolean
}

export interface Todo {
  id: string
  title: string
  completed: boolean
  labelIds: string[]
  listId?: string
  workflowId?: string
  workflowStage?: string
  blocked?: boolean
  assigneeIds?: string[]
  dueDate?: string
  dueTime?: string
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  createdAt?: string
  priority?: 'low' | 'medium' | 'high'
  attributes?: Record<string, any>
  order?: number
  userId: string
  linkedNoteIds?: string[]
  serverId?: number // Server task ID for sync
  clientId?: string // Client-generated correlation id to avoid duplicates
  shared?: boolean
}

// v0.0.57: SavedFilter rebuilt to match Label architecture exactly
export interface SavedFilter {
  id: number  // Changed from string to number (auto-increment)
  name: string
  normalizedName: string  // NEW: For deduplication (like labels)
  queryJson: FilterQuery  // NEW: Filter rules object
  menuVisible: boolean  // NEW: Toggle for menu visibility (unique to filters)
  shared: boolean  // Like labels
  ownerId: number  // Like labels (owner_id)
  ranking: number  // For custom ordering (0 = default/alphabetical)
  createdAt: string  // Like labels
  updatedAt: string  // Like labels
  version: number  // NEW: For sync conflict resolution
}

// v0.0.57: FilterQuery interface - defines the structure of queryJson
export interface FilterQuery {
  selectedLabelIds?: string[]
  selectedAssigneeIds?: string[]
  selectedWorkflowIds?: string[]
  blockedOnly?: boolean
  dueStart?: string | null
  dueEnd?: string | null
  showCompleted?: boolean
  showArchived?: boolean
  sortBy?: string
  // Add more filter criteria as needed
}

export interface List {
  id: string
  name: string
  description?: string
  labelIds?: string[]
  workflowId?: string
  visibility?: 'public' | 'private'
}

export interface AttributeOption {
  value: string
  label?: string
  icon?: string // optional icon per option (e.g., 🇫🇷 for France)
}

export interface AttributeDef {
  id: string
  name: string
  type: 'text' | 'number' | 'select' | 'date' | 'workflow'
  defaultValue?: any
  icon?: string // default icon for the attribute
  options?: AttributeOption[] // for type 'select': dropdown choices
  isDefault?: boolean
}
 
export interface PointsEntry {
  id: string
  userId: string
  todoId: string
  points: number
  date: string
}

export interface AppSettings {
  id: string
  hideCompleted?: boolean
  defaultSort?: 'order' | 'alpha' | 'created' | 'due'
  defaultWorkflowType?: string
  defaultView?: string
  themeColor?: string
}

export interface Note {
  id: string
  title: string
  content: string
  labelIds: string[]
  pinned?: boolean
  archived?: boolean
  shared?: boolean
  dueDate?: string
  flagged?: boolean
  attributes?: Record<string, any>
  createdAt: string
  updatedAt: string
  userId: string
  linkedTodoIds?: string[]
  serverId?: number // Server note ID for sync
  clientId?: string // Client-generated correlation ID to avoid duplicates
  version?: number // Version tracking for conflict resolution
}
 
