interface Props {
  placeholder?: string
  buttonText?: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
}

export default function AddBar({
  placeholder = 'Add new...',
  buttonText = 'Create',
  value,
  onChange,
  onSubmit,
  disabled = false
}: Props) {
  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          placeholder={placeholder}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && !disabled) onSubmit()
          }}
          autoFocus
        />
        <button
          className="btn border-accent text-accent"
          disabled={disabled}
          onClick={onSubmit}
        >
          + {buttonText}
        </button>
      </div>
    </div>
  )
}
