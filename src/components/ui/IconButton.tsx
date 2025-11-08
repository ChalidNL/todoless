import { ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  active?: boolean
  activeColor?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'ghost'
}

export default function IconButton({
  icon,
  active = false,
  activeColor = '#4f46e5',
  size = 'md',
  variant = 'default',
  className,
  ...props
}: IconButtonProps) {
  const sizeClasses = {
    sm: 'p-1 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-3 text-base',
  }

  return (
    <button
      type="button"
      className={clsx(
        'icon-button',
        'inline-flex items-center justify-center',
        'transition-all duration-200 ease-in-out',
        'rounded-lg',
        {
          // Default variant with border
          'border border-gray-200 bg-white': variant === 'default',
          'hover:bg-gray-50': variant === 'default' && !active,
          
          // Ghost variant (no border)
          'bg-transparent': variant === 'ghost',
          'hover:bg-gray-100': variant === 'ghost' && !active,
          
          // Base color (inactive state)
          'text-gray-800': !active,
          
          // Active state uses inline style for custom color
        },
        sizeClasses[size],
        'hover:scale-105',
        className
      )}
      style={active ? { color: activeColor, borderColor: activeColor } : undefined}
      {...props}
    >
      {icon}
    </button>
  )
}
