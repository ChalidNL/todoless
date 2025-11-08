import { useEffect } from 'react'

type ShortcutHandler = (e: KeyboardEvent) => void

export function useShortcuts(handlers: Record<string, ShortcutHandler>) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow Esc to still work
        if (e.key !== 'Escape') return
      }

      for (const [key, handler] of Object.entries(handlers)) {
        const parts = key.split('+')
        const mainKey = parts[parts.length - 1].toLowerCase()
        const needsCtrl = parts.includes('ctrl')
        const needsShift = parts.includes('shift')
        const needsAlt = parts.includes('alt')

        if (
          e.key.toLowerCase() === mainKey &&
          e.ctrlKey === needsCtrl &&
          e.shiftKey === needsShift &&
          e.altKey === needsAlt
        ) {
          e.preventDefault()
          handler(e)
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
