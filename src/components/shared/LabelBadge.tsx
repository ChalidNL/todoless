import React from 'react';
import { Label } from '../../types';

interface LabelBadgeProps {
  label: Label;
  onRemove?: (e?: React.MouseEvent) => void;
  size?: 'sm' | 'md';
}

export const LabelBadge = ({ label, onRemove, size = 'md' }: LabelBadgeProps) => {
  return (
    <span
      className={`chip ${
        size === 'sm' ? '' : 'px-2'
      }`}
      style={{
        backgroundColor: `${label.color}15`,
        color: label.color,
      }}
    >
      {label.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          className="hover:opacity-70"
        >
          ×
        </button>
      )}
    </span>
  );
};