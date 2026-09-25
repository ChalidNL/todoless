import React, { useState } from 'react';
import { Tag } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { sortLabelsByVisibility } from '../../lib/label-utils';

interface LabelSelectorProps {
  selectedLabelIds: string[];
  onLabelToggle?: (labelId: string) => void;
  onToggleLabel?: (labelId: string) => void;
}

export const LabelSelector = ({ selectedLabelIds, onLabelToggle, onToggleLabel }: LabelSelectorProps) => {
  const { labels } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleToggle = (labelId: string) => {
    if (onLabelToggle) onLabelToggle(labelId);
    if (onToggleLabel) onToggleLabel(labelId);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 hover:bg-neutral-100 rounded transition-colors"
      >
        <Tag className="w-4 h-4 text-neutral-500" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-20 min-w-[160px]">
            {sortLabelsByVisibility(labels).map((label) => (
              <button
                key={label.id}
                onClick={() => {
                  handleToggle(label.id);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
              >
                <input
                  type="checkbox"
                  checked={selectedLabelIds.includes(label.id)}
                  readOnly
                  className="pointer-events-none"
                />
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};