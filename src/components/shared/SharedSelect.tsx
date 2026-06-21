import React from 'react';

interface SharedSelectOption<T extends string> {
  value: T;
  label: string;
}

interface SharedSelectProps<T extends string> {
  value: T;
  options: SharedSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  id?: string;
}

export function SharedSelect<T extends string>({ value, options, onChange, ariaLabel, className = '', id }: SharedSelectProps<T>) {
  return (
    <select
      id={id}
      data-component="shared-select"
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={`text-xs px-2 py-1 border border-neutral-200 rounded bg-white text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-300 ${className}`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
