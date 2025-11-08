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
  repeat?: 'daily' | 'weekly' | 'monthly' | null
  createdAt?: string
  priority?: 'low' | 'medium' | 'high'
  attributes?: Record<string, any>
  order?: number
  userId: string
  linkedNoteIds?: string[]
  serverId?: number // Server task ID for sync
  clientId?: string // Client-generated correlation id to avoid duplicates
}

export interface SavedView {
  id: string
  name: string
  icon?: string
  labelFilterIds?: string[]
  attributeFilters?: Record<string, any>
  statusFilter?: string
  sortBy?: string
  viewMode?: 'list' | 'tiles' | 'calendar' | 'kanban'
  userId: string
  showInSidebar?: boolean
  isSystem?: boolean
  isDefault?: boolean
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
  sharedWith?: string[] // user IDs
  dueDate?: string
  flagged?: boolean
  attributes?: Record<string, any>
  createdAt: string
  updatedAt: string
  userId: string
  linkedTodoIds?: string[]
}
 
