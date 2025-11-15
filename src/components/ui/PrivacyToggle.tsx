import { useState } from 'react'
import ToggleSwitch from './ToggleSwitch'

interface PrivacyToggleProps {
  shared: boolean
  onChange: (shared: boolean) => Promise<void> | void
  disabled?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md'
  ownerId?: string // Owner ID of the item
  currentUserId?: string // Current user ID
}

/**
 * Privacy Toggle Component
 *
 * Displays a toggle switch for controlling shared/private state of items.
 * Shows lock icon (yellow when private, gray when shared).
 * Only enabled for owners of the item.
 */
export default function PrivacyToggle({
  shared,
  onChange,
  disabled = false,
  showLabel = true,
  size = 'sm',
  ownerId,
  currentUserId
}: PrivacyToggleProps) {
  const [isChanging, setIsChanging] = useState(false)

  // Determine if current user is owner
  const isOwner = !ownerId || !currentUserId || ownerId === currentUserId
  const isDisabled = disabled || !isOwner || isChanging

  const handleChange = async (newShared: boolean) => {
    if (isDisabled) return

    setIsChanging(true)
    try {
      await onChange(newShared)
    } catch (error) {
      console.error('Failed to update privacy:', error)
    } finally {
      setIsChanging(false)
    }
  }

  const label = shared ? 'Shared' : 'Private'
  const statusText = !isOwner ? ' (owner only)' : ''

  return (
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 flex items-center justify-center rounded ${!shared ? 'text-yellow-600' : 'text-gray-500'}`} title={label}>
        <svg className="w-5 h-5" fill={!shared ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <ToggleSwitch
        checked={shared}
        onChange={handleChange}
        disabled={isDisabled}
        label={showLabel ? label + statusText : undefined}
        size={size}
      />
      {isChanging && (
        <span className="text-xs text-gray-400 italic">Updating...</span>
      )}
    </div>
  )
}
