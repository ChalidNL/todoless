import React, { useState, useEffect } from 'react';
import { Plus, Filter, X, Check, Circle, AlertCircle, Flag, User, Tag, Zap, ShoppingCart, MapPin, CalendarDays, Repeat, CheckSquare } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LabelBadge } from './LabelBadge';
import { Priority, Horizon, TaskStatus } from '../../types';

interface NewGlobalHeaderProps {
  onSearch?: (query: string) => void;
  onAdd?: (value: string, metadata?: { assignee?: string; labels?: string[]; dueDate?: number; sprintId?: string }) => void;
  onFilter?: (filters: any) => void;
  searchPlaceholder?: string;
  type?: 'task' | 'item' | 'note' | 'calendar';
  showFilters?: boolean;
  showSearch?: boolean;
  showAdd?: boolean;
}

export const NewGlobalHeader = ({ 
  onSearch, 
  onAdd, 
  onFilter,
  searchPlaceholder = "Search...",
  type = 'task',
  showFilters = true,
  showSearch = true,
  showAdd = true
}: NewGlobalHeaderProps) => {
  const [inputValue, setInputValue] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const { users, labels, filters, items, shops, appSettings, sprints } = useApp();

  // Common filter states
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  // Task specific filters
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<Priority[]>([]);
  const [selectedHorizon, setSelectedHorizon] = useState<Horizon[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [hasSprintId, setHasSprintId] = useState<boolean | undefined>(undefined);
  const [blocked, setBlocked] = useState<boolean | undefined>(undefined);

  // Sprint assignment for new tasks
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');

  // Item specific filters
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [belowMinimumStock, setBelowMinimumStock] = useState<boolean | undefined>(undefined);

  // Note specific filters
  const [selectedLinkedTypes, setSelectedLinkedTypes] = useState<('task' | 'item')[]>([]);

  // Calendar specific filters
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [hasRecurring, setHasRecurring] = useState<boolean | undefined>(undefined);

  // Auto-apply filters when any filter changes
  useEffect(() => {
    applyFilter();
  }, [selectedLabels, showCompleted, selectedStatus, selectedPriority, selectedHorizon, 
      selectedAssignees, hasSprintId, blocked, selectedShops, selectedCategories, selectedLocations, 
      belowMinimumStock, selectedLinkedTypes, dateRange, hasRecurring]);

  const parseInput = (text: string) => {
    let cleanText = text;
    const metadata: { assignee?: string; labels?: string[]; dueDate?: number; sprintId?: string } = {};

    // Parse @me or @user (assignee)
    const assigneeMatch = text.match(/@(\w+)/);
    if (assigneeMatch) {
      const userName = assigneeMatch[1];
      if (userName.toLowerCase() === 'me' && appSettings.currentUserId) {
        metadata.assignee = appSettings.currentUserId;
        cleanText = cleanText.replace(assigneeMatch[0], '').trim();
      } else {
        const user = users.find(u => u.name.toLowerCase() === userName.toLowerCase());
        if (user) {
          metadata.assignee = user.id;
          cleanText = cleanText.replace(assigneeMatch[0], '').trim();
        }
      }
    }

    // Parse #label (can have multiple)
    const labelMatches = text.matchAll(/#(\w+)/g);
    const labelIds: string[] = [];
    for (const match of labelMatches) {
      const labelName = match[1];
      const label = labels.find(l => l.name.toLowerCase() === labelName.toLowerCase());
      if (label) {
        labelIds.push(label.id);
        cleanText = cleanText.replace(match[0], '').trim();
      }
    }
    if (labelIds.length > 0) {
      metadata.labels = labelIds;
    }

    // Parse //date (due date)
    const dateMatch = text.match(/\/\/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        metadata.dueDate = date.getTime();
        cleanText = cleanText.replace(dateMatch[0], '').trim();
      }
    }

    return { cleanText, metadata };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleAdd = () => {
    if (!inputValue.trim() || !onAdd) return;
    const { cleanText, metadata } = parseInput(inputValue);
    onAdd(cleanText, metadata);
    setInputValue('');
    // Clear search filter after adding so the new task is visible
    if (onSearch) {
      onSearch('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      handleAdd();
    }
  };

  const toggleArrayValue = <T,>(arr: T[], value: T, setter: (arr: T[]) => void) => {
    if (arr.includes(value)) {
      setter(arr.filter(v => v !== value));
    } else {
      setter([...arr, value]);
    }
  };

  const getUniqueCategories = () => {
    const categories = items.map(i => i.category).filter(Boolean) as string[];
    return [...new Set(categories)];
  };

  const getUniqueLocations = () => {
    const locations = items.map(i => i.location).filter(Boolean) as string[];
    return [...new Set(locations)];
  };

  const applyFilter = () => {
    if (!onFilter) return;

    const activeFilters: any = {
      showCompleted,
    };

    if (selectedLabels.length > 0) activeFilters.labelIds = selectedLabels;

    if (type === 'task') {
      if (selectedStatus.length > 0) activeFilters.status = selectedStatus;
      if (selectedPriority.length > 0) activeFilters.priority = selectedPriority;
      if (selectedHorizon.length > 0) activeFilters.horizon = selectedHorizon;
      if (selectedAssignees.length > 0) activeFilters.assignedTo = selectedAssignees;
      if (hasSprintId !== undefined) activeFilters.hasSprintId = hasSprintId;
      if (blocked !== undefined) activeFilters.blocked = blocked;
    } else if (type === 'item') {
      if (selectedShops.length > 0) activeFilters.shopIds = selectedShops;
      if (selectedCategories.length > 0) activeFilters.category = selectedCategories;
      if (selectedLocations.length > 0) activeFilters.location = selectedLocations;
      if (belowMinimumStock !== undefined) activeFilters.belowMinimumStock = belowMinimumStock;
    } else if (type === 'note') {
      if (selectedLinkedTypes.length > 0) activeFilters.linkedType = selectedLinkedTypes;
    } else if (type === 'calendar') {
      if (selectedAssignees.length > 0) activeFilters.assignedTo = selectedAssignees;
      if (dateRange.start) activeFilters.startDate = dateRange.start;
      if (dateRange.end) activeFilters.endDate = dateRange.end;
      if (hasRecurring !== undefined) activeFilters.hasRecurring = hasRecurring;
    }

    onFilter(activeFilters);
  };

  const clearFilters = () => {
    setSelectedLabels([]);
    setShowCompleted(false);
    setSelectedStatus([]);
    setSelectedPriority([]);
    setSelectedHorizon([]);
    setSelectedAssignees([]);
    setHasSprintId(undefined);
    setBlocked(undefined);
    setSelectedShops([]);
    setSelectedCategories([]);
    setSelectedLocations([]);
    setBelowMinimumStock(undefined);
    setSelectedLinkedTypes([]);
    setDateRange({});
    setHasRecurring(undefined);
  };

  const typeFilters = filters.filter(f => f.type === type);

  const getStatusIcon = (status: TaskStatus) => {
    if (status === 'done') return <Check className="w-3 h-3" />;
    if (status === 'todo') return <Circle className="w-3 h-3" />;
    return <AlertCircle className="w-3 h-3" />;
  };

  const getPriorityIcon = (priority: Priority) => {
    return <Flag className="w-3 h-3" />;
  };

  return (
    <>
      {/* Header Bar */}
      <div className="bg-black border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-center gap-2 text-white w-full">
            <CheckSquare className="w-8 h-8" strokeWidth={2.5} />
            <span className="text-xl font-semibold tracking-tight">todoless</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Icon */}
            {showFilters && (
              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`p-2 rounded-md flex-shrink-0 text-white hover:bg-neutral-800 ${
                  showFilterPanel ? 'bg-neutral-800' : ''
                }`}
                title="Filters"
              >
                <Filter className="w-4 h-4" />
              </button>
            )}

            {/* Search/Input Bar */}
            {showSearch && (
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full px-3 py-2 bg-neutral-900 text-white border border-neutral-700 rounded-md focus:outline-none focus:border-neutral-500 text-sm"
                />
              </div>
            )}

            {/* Add Button */}
            {showAdd && (
              <button
                onClick={handleAdd}
                className="p-2 bg-white text-black rounded-md hover:bg-neutral-200 flex-shrink-0"
                title="Add"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="border-b border-neutral-200 bg-neutral-50">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
            {/* Labels */}
            {labels.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Tag className="w-3.5 h-3.5 text-neutral-600" />
                  <span className="text-xs font-medium text-neutral-700">Labels</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map(label => (
                    <button
                      key={label.id}
                      onClick={() => toggleArrayValue(selectedLabels, label.id, setSelectedLabels)}
                      className={`transition-opacity ${
                        selectedLabels.includes(label.id) ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <LabelBadge label={label} size="sm" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Task Specific Filters */}
            {type === 'task' && (
              <>
                {/* Status */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Circle className="w-3.5 h-3.5 text-neutral-600" />
                    <span className="text-xs font-medium text-neutral-700">Status</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['backlog', 'todo', 'done'] as TaskStatus[]).map(status => (
                      <button
                        key={status}
                        onClick={() => toggleArrayValue(selectedStatus, status, setSelectedStatus)}
                        className={`px-2 py-1 rounded text-xs capitalize transition-colors flex items-center gap-1 ${
                          selectedStatus.includes(status)
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-neutral-600'
                        }`}
                      >
                        {getStatusIcon(status)}
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Flag className="w-3.5 h-3.5 text-neutral-600" />
                    <span className="text-xs font-medium text-neutral-700">Priority</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['urgent', 'normal', 'low'] as Priority[]).map(priority => (
                      <button
                        key={priority}
                        onClick={() => toggleArrayValue(selectedPriority, priority, setSelectedPriority)}
                        className={`px-2 py-1 rounded text-xs capitalize transition-colors flex items-center gap-1 ${
                          selectedPriority.includes(priority)
                            ? 'bg-neutral-900 text-white'
                            : 'bg-white border border-neutral-200 text-neutral-600'
                        }`}
                      >
                        {getPriorityIcon(priority)}
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assignees */}
                {users.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <User className="w-3.5 h-3.5 text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-700">Assigned</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {/* @me filter */}
                      {appSettings.currentUserId && (
                        <button
                          onClick={() => toggleArrayValue(selectedAssignees, appSettings.currentUserId!, setSelectedAssignees)}
                          className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                            selectedAssignees.includes(appSettings.currentUserId)
                              ? 'bg-neutral-900 text-white'
                              : 'bg-white border border-neutral-200 text-neutral-600'
                          }`}
                        >
                          <User className="w-3 h-3" />
                          @me
                        </button>
                      )}
                      {users.map(user => (
                        <button
                          key={user.id}
                          onClick={() => toggleArrayValue(selectedAssignees, user.id, setSelectedAssignees)}
                          className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                            selectedAssignees.includes(user.id)
                              ? 'bg-neutral-900 text-white'
                              : 'bg-white border border-neutral-200 text-neutral-600'
                          }`}
                        >
                          <User className="w-3 h-3" />
                          {user.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick toggles */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setHasSprintId(hasSprintId === true ? undefined : true)}
                    className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                      hasSprintId === true
                        ? 'bg-neutral-900 text-white'
                        : 'bg-white border border-neutral-200 text-neutral-600'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    Sprint
                  </button>
                  <button
                    onClick={() => setBlocked(blocked === true ? undefined : true)}
                    className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                      blocked === true
                        ? 'bg-neutral-900 text-white'
                        : 'bg-white border border-neutral-200 text-neutral-600'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3" />
                    Blocked
                  </button>
                </div>
              </>
            )}

            {/* Item Specific Filters */}
            {type === 'item' && (
              <>
                {/* Shops */}
                {shops && shops.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-700">Shops</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {shops.map(shop => (
                        <button
                          key={shop.id}
                          onClick={() => toggleArrayValue(selectedShops, shop.id, setSelectedShops)}
                          className={`transition-opacity ${
                            selectedShops.includes(shop.id) ? 'opacity-100' : 'opacity-40'
                          }`}
                        >
                          <LabelBadge label={shop} size="sm" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Locations */}
                {getUniqueLocations().length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-700">Location</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {getUniqueLocations().map(location => (
                        <button
                          key={location}
                          onClick={() => toggleArrayValue(selectedLocations, location, setSelectedLocations)}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            selectedLocations.includes(location)
                              ? 'bg-neutral-900 text-white'
                              : 'bg-white border border-neutral-200 text-neutral-600'
                          }`}
                        >
                          {location}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Calendar Specific Filters */}
            {type === 'calendar' && (
              <>
                {/* Assignees for Calendar */}
                {users.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <User className="w-3.5 h-3.5 text-neutral-600" />
                      <span className="text-xs font-medium text-neutral-700">Assigned</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {appSettings.currentUserId && (
                        <button
                          onClick={() => toggleArrayValue(selectedAssignees, appSettings.currentUserId!, setSelectedAssignees)}
                          className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                            selectedAssignees.includes(appSettings.currentUserId)
                              ? 'bg-neutral-900 text-white'
                              : 'bg-white border border-neutral-200 text-neutral-600'
                          }`}
                        >
                          <User className="w-3 h-3" />
                          @me
                        </button>
                      )}
                      {users.map(user => (
                        <button
                          key={user.id}
                          onClick={() => toggleArrayValue(selectedAssignees, user.id, setSelectedAssignees)}
                          className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                            selectedAssignees.includes(user.id)
                              ? 'bg-neutral-900 text-white'
                              : 'bg-white border border-neutral-200 text-neutral-600'
                          }`}
                        >
                          <User className="w-3 h-3" />
                          {user.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setHasRecurring(hasRecurring === true ? undefined : true)}
                  className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                    hasRecurring === true
                      ? 'bg-neutral-900 text-white'
                      : 'bg-white border border-neutral-200 text-neutral-600'
                  }`}
                >
                  <Repeat className="w-3 h-3" />
                  Recurring
                </button>
              </>
            )}

            {/* Common Toggles */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                  showCompleted
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white border border-neutral-200 text-neutral-600'
                }`}
              >
                <Check className="w-3 h-3" />
                Completed
              </button>
            </div>

            {/* Clear Button */}
            <button
              onClick={clearFilters}
              className="w-full px-3 py-1.5 bg-white border border-neutral-200 rounded text-xs flex items-center justify-center gap-1.5 hover:bg-neutral-50"
            >
              <X className="w-3.5 h-3.5" />
              Clear All
            </button>
          </div>
        </div>
      )}
    </>
  );
};