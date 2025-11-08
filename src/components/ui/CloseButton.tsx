interface Props {
  onClick?: () => void
  label?: string
  className?: string
}

export default function CloseButton({ onClick, label = 'Close', className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`p-1.5 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-800 bg-white hover:bg-gray-50 transition-all hover:scale-105 ${className}`}
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  )
}
