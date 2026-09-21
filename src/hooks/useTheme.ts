'use client'
import { useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'seyes-theme'

function apply(choice: ThemeChoice) {
  if (choice === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', choice)
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>('system')

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY) as ThemeChoice | null
    // One-time read from localStorage on mount, mirroring the pattern used
    // elsewhere in this app (FontSwitcher/page.tsx): localStorage is only
    // reachable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage on mount, not a render-triggered cascade
    if (stored === 'light' || stored === 'dark' || stored === 'system') setThemeState(stored)
  }, [])

  function setTheme(next: ThemeChoice) {
    setThemeState(next)
    apply(next)
    if (next === 'system') window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, next)
  }

  return { theme, setTheme }
}
