'use client'
import { useEffect, useRef, useState } from 'react'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Saves 600ms after typing stops, and again on blur and on unload so that
 * closing the window mid-sentence never loses the sentence.
 */
export function useAutosave(save: () => Promise<void>, deps: unknown[]) {
  const [state, setState] = useState<SaveState>('idle')
  const saveRef = useRef(save)
  // Intentional "latest ref" pattern: keeps flush() calling the newest
  // `save` closure without re-running the debounce effect below on every
  // render. eslint's newer compiler-oriented rule flags any ref write
  // during render on principle; this one is deliberate and safe (it never
  // reads back during this same render).
  // eslint-disable-next-line react-hooks/refs
  saveRef.current = save
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useRef(async () => {
    if (!dirty.current) return
    dirty.current = false
    setState('saving')
    try {
      await saveRef.current()
      setState('saved')
    } catch {
      setState('error')
      dirty.current = true
    }
  })

  useEffect(() => {
    dirty.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush.current(), 600)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    const onHide = () => void flush.current()
    window.addEventListener('blur', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      window.removeEventListener('blur', onHide)
      window.removeEventListener('beforeunload', onHide)
      // `flush` is a ref holding a stable function, never reassigned after
      // its initial useRef() call, so it cannot have "changed" by cleanup
      // time the way a DOM-node ref could. Safe to read here.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      void flush.current()
    }
  }, [])

  return state
}
