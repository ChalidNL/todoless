import { useEffect, useState } from 'react'

const KEY = 'todoless:themeColor'

export function useUserTheme() {
  const [color, setColor] = useState<string>(() => {
    return localStorage.getItem(KEY) || '#0ea5e9'
  })

  useEffect(() => {
    localStorage.setItem(KEY, color)
    // Update CSS variable for tailwind accent color (rgb values)
    const el = document.documentElement
    const hex = color.replace('#', '')
  const rgb = hex.match(/.{1,2}/g)?.map((n: string) => parseInt(n, 16)).join(' ') || '14 165 233'
    el.style.setProperty('--accent', rgb)
  }, [color])

  return { color, setColor }
}
