import React, { useState, useRef, useEffect } from 'react';
import { t } from '../../i18n/translations';

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  onDelete?: () => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  completed?: boolean;
}

export const EditableText = ({
  value,
  onChange,
  onDelete,
  placeholder = t('common.typeHere'),
  className = '',
  multiline = false,
  completed = false,
}: EditableTextProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue.trim()) {
      onChange(editValue.trim());
      setIsEditing(false);
    } else if (onDelete) {
      onDelete();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent border-none outline-none resize-none ${className}`}
          rows={3}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full bg-transparent border-none outline-none ${className}`}
      />
    );
  }

  return (
    <div
      onClick={() => {
        setEditValue(value);
        setIsEditing(true);
      }}
      className={`cursor-text ${completed ? 'line-through text-neutral-400' : ''} ${className}`}
    >
      {value || <span className="text-neutral-400">{placeholder}</span>}
    </div>
  );
};
