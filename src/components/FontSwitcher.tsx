'use client'
import { useEffect, useState } from 'react'

export const FONTS = {
  courier: { label: 'Courier', stack: '"Courier New", Courier, monospace' },
  verdana: { label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  georgia: { label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
} as const

export type FontKey = keyof typeof FONTS

export function FontSwitcher() {
  const [font, setFont] = useState<FontKey>('courier')

  useEffect(() => {
    const stored = window.localStorage.getItem('seyes-font') as FontKey | null
    // localStorage is only reachable after mount (no window on the server),
    // so this one-time sync from an external store to state must happen in
    // an effect rather than during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage on mount, not a render-triggered cascade
    if (stored && stored in FONTS) setFont(stored)
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--writing-font', FONTS[font].stack)
    window.localStorage.setItem('seyes-font', font)
  }, [font])

  return (
    <div className="fonts">
      {(Object.keys(FONTS) as FontKey[]).map((key) => (
        <button
          key={key}
          className={font === key ? 'on' : ''}
          style={{ fontFamily: FONTS[key].stack }}
          onClick={() => setFont(key)}
        >
          {FONTS[key].label}
        </button>
      ))}
    </div>
  )
}
