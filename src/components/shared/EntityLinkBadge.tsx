import React from 'react';
import { Link, ShoppingCart, StickyNote, FolderKanban, X } from 'lucide-react';

export type LinkedEntityType = 'task' | 'item' | 'note' | 'project';

interface EntityLinkBadgeProps {
  entityId: string;
  entityType: LinkedEntityType;
  entityTitle?: string;
  onNavigate?: (type: LinkedEntityType, id: string) => void;
  onRemove?: (entityId: string) => void;
}

const entityTypeConfig: Record<LinkedEntityType, { icon: React.ReactNode; color: string; label: string }> = {
  task: { icon: <Link className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700', label: 'Task' },
  item: { icon: <ShoppingCart className="w-3 h-3" />, color: 'bg-green-100 text-green-700', label: 'Item' },
  note: { icon: <StickyNote className="w-3 h-3" />, color: 'bg-yellow-100 text-yellow-700', label: 'Note' },
  project: { icon: <FolderKanban className="w-3 h-3" />, color: 'bg-purple-100 text-purple-700', label: 'Project' },
};

export const EntityLinkBadge: React.FC<EntityLinkBadgeProps> = ({
  entityId,
  entityType,
  entityTitle,
  onNavigate,
  onRemove,
}) => {
  const config = entityTypeConfig[entityType];
  const displayTitle = entityTitle || `${config.label} ${entityId.slice(0, 8)}`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${
        onNavigate ? 'cursor-pointer hover:opacity-80' : ''
      }`}
      onClick={() => onNavigate?.(entityType, entityId)}
      title={`${config.label}: ${displayTitle}`}
    >
      {config.icon}
      <span className="truncate max-w-[120px]">{displayTitle}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(entityId);
          }}
          className="ml-0.5 hover:opacity-70"
          title={`Remove ${config.label} link`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

interface EntityLinkPickerProps {
  currentLinkIds: string[];
  availableEntities: { id: string; title: string }[];
  entityType: LinkedEntityType;
  onAdd: (entityId: string) => void;
  onRemove: (entityId: string) => void;
}

export const EntityLinkPicker: React.FC<EntityLinkPickerProps> = ({
  currentLinkIds,
  availableEntities,
  entityType,
  onAdd,
  onRemove,
}) => {
  const config = entityTypeConfig[entityType];
  const unlinked = availableEntities.filter((e) => !currentLinkIds.includes(e.id));

  if (unlinked.length === 0 && currentLinkIds.length === 0) {
    return (
      <p className="text-xs text-neutral-400">No {entityType}s available to link</p>
    );
  }

  return (
    <div className="space-y-1">
      {currentLinkIds.map((id) => {
        const entity = availableEntities.find((e) => e.id === id);
        return (
          <EntityLinkBadge
            key={id}
            entityId={id}
            entityType={entityType}
            entityTitle={entity?.title}
            onRemove={onRemove}
          />
        );
      })}
      {unlinked.length > 0 && (
        <details className="mt-1">
          <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-700">
            + Link {config.label.toLowerCase()}...
          </summary>
          <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
            {unlinked.map((entity) => (
              <button
                key={entity.id}
                onClick={() => onAdd(entity.id)}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-neutral-100 flex items-center gap-2"
              >
                {config.icon}
                <span>{entity.title}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
