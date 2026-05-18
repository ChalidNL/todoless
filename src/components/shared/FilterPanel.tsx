import React, { useState } from 'react';
import { Plus, X, Edit2, Trash2, Tag, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LabelBadge } from './LabelBadge';
import { entityColor, entityBg } from '../../lib/entity-colors';

interface FilterPanelProps {
  type: 'task' | 'item';
  selectedFilterId: string | null;
  setSelectedFilterId: (id: string | null) => void;
  newFilterName: string;
  setNewFilterName: (name: string) => void;
  onCreateFilter: () => void;
  jqlQuery?: string;
  setJqlQuery?: (query: string) => void;
}

export const FilterPanel = ({
  type,
  selectedFilterId,
  setSelectedFilterId,
  newFilterName,
  setNewFilterName,
  onCreateFilter,
  jqlQuery,
  setJqlQuery,
}: FilterPanelProps) => {
  const { labels, filters, users, activeLabelFilters, toggleLabelFilter, deleteLabel, addLabel, deleteFilter } = useApp();
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = useState('');

  const typeFilters = filters.filter(f => f.type === type);

  const handleCreateLabel = () => {
    if (newLabelName.trim()) {
      addLabel({
        name: newLabelName.trim(),
        color: newLabelColor,
        isPrivate: false,
      });
      setNewLabelName('');
      setShowNewLabel(false);
    }
  };

  const handleDeleteLabel = (id: string) => {
    deleteLabel(id);
  };

  const handleSaveFilter = () => {
    if (newFilterName.trim()) {
      onCreateFilter();
    }
  };

  const handleSaveJqlFilter = () => {
    if (newFilterName.trim() && jqlQuery) {
      // Save as JQL filter
      const filter = {
        name: newFilterName.trim(),
        labelIds: activeLabelFilters,
        showCompleted: true,
        type: type as 'task' | 'item' | 'note',
        query: jqlQuery,
      };
      // This would need to be passed to parent - for now, just show message
      setNewFilterName('');
    }
  };

  const PRESET_COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
  ];

  return (
    <div className="border-b border-neutral-200 bg-neutral-50">
      <div className="max-w-lg mx-auto px-4 py-3 space-y-4">
        {/* Saved filters */}
        {typeFilters.length > 0 && (
          <div>
            <p className="text-xs text-neutral-500 mb-2">Saved Filters</p>
            <div className="flex flex-wrap gap-2">
              {typeFilters.map(filter => (
                <div key={filter.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedFilterId(filter.id === selectedFilterId ? null : filter.id);
                    }}
                    className={`px-3 py-1.5 rounded text-xs transition-colors ${
                      selectedFilterId === filter.id
                        ? 'bg-neutral-900 text-white'
                        : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    {filter.name}
                  </button>
                  <button
                    onClick={() => deleteFilter(filter.id)}
                    className="p-1 hover:bg-neutral-200 rounded"
                    title="Delete filter"
                  >
                    <X className="w-3 h-3 text-neutral-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Label filters */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-neutral-500">Filter by Label</p>
            <button
              onClick={() => setShowNewLabel(!showNewLabel)}
              className="text-xs text-neutral-600 hover:text-neutral-800 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              New Label
            </button>
          </div>

          {/* Label list with edit/delete */}
          <div className="flex flex-wrap gap-2 mb-2">
            {labels.map(label => (
              <div key={label.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => toggleLabelFilter(label.id)}
                  className={`cursor-pointer ${activeLabelFilters.includes(label.id) ? 'ring-2 ring-neutral-900 rounded-full' : ''}`}
                >
                  <LabelBadge label={label} size="sm" />
                </button>
                <button
                  onClick={() => {
                    setEditingLabelId(label.id);
                    setEditingLabelName(label.name);
                  }}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-neutral-200 rounded transition-opacity"
                  title="Edit label"
                >
                  <Edit2 className="w-2.5 h-2.5 text-neutral-500" />
                </button>
                <button
                  onClick={() => handleDeleteLabel(label.id)}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-opacity"
                  title="Delete label"
                >
                  <Trash2 className="w-2.5 h-2.5 text-red-400" />
                </button>
              </div>
            ))}
          </div>

          {/* Create new label form */}
          {showNewLabel && (
            <div className="p-3 bg-white border border-neutral-200 rounded space-y-2">
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Label name..."
                className="w-full px-2 py-1 border border-neutral-200 rounded text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
              />
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewLabelColor(color)}
                    className={`w-6 h-6 rounded-full border-2 ${newLabelColor === color ? 'border-neutral-900' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateLabel}
                  disabled={!newLabelName.trim()}
                  className="px-3 py-1 bg-neutral-900 text-white rounded text-xs disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowNewLabel(false);
                    setNewLabelName('');
                  }}
                  className="px-3 py-1 text-neutral-600 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter by Assignee (only for tasks) */}
        {type === 'task' && users.length > 0 && (
          <div>
            <p className="text-xs text-neutral-500 mb-2">Filter by Assignee</p>
              <div className="flex flex-wrap gap-2">
                {users.map(user => (
                  <span
                    key={user.id}
                    className="chip cursor-pointer"
                    style={{ backgroundColor: entityBg(user.id), color: entityColor(user.id) }}
                  >
                    <User className="w-2.5 h-2.5" strokeWidth={2} />
                    {user.name}
                  </span>
                ))}
              </div>
          </div>
        )}

        {/* Create new filter */}
        <div className="border-t border-neutral-200 pt-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              placeholder="New filter name..."
              className="flex-1 px-3 py-1.5 border border-neutral-200 rounded text-sm bg-white"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveFilter()}
            />
            <button
              onClick={handleSaveFilter}
              disabled={!newFilterName.trim()}
              className="px-3 py-1.5 bg-neutral-900 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Save
            </button>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {jqlQuery ? 'Saves current JQL query and label filters' : 'Select labels above, then save as filter'}
          </p>
        </div>
      </div>
    </div>
  );
};
