interface CreateButtonProps {
  onClick: () => void
  title?: string
  className?: string
}

export default function CreateButton({ onClick, title = "Create", className = "" }: CreateButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-11 flex items-center justify-center rounded-md bg-accent text-white hover:opacity-90 transition-opacity shadow-sm ${className}`}
      title={title}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    </button>
  )
}
