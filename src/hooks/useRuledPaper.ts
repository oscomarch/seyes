'use client'
import { useEffect, useState } from 'react'

const KEY = 'seyes-ruled'

export function useRuledPaper() {
  const [ruled, setRuledState] = useState(true)

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY)
    // One-time read from localStorage on mount (same pattern as useTheme).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage on mount, not a render-triggered cascade
    if (stored !== null) setRuledState(stored === '1')
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-ruled', ruled ? '1' : '0')
  }, [ruled])

  function setRuled(next: boolean) {
    setRuledState(next)
    window.localStorage.setItem(KEY, next ? '1' : '0')
  }

  return { ruled, setRuled }
}
