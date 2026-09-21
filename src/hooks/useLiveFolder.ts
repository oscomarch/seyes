'use client'
import { useEffect } from 'react'

/**
 * Calls `onChange` whenever anything in the writing folder changes on disk,
 * including edits made outside Seyes. Reconnects on its own if the stream
 * drops, so leaving the app open overnight does not silently stop working.
 */
export function useLiveFolder(onChange: () => void) {
  useEffect(() => {
    let source: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const connect = () => {
      if (stopped) return
      source = new EventSource('/api/watch')
      source.onmessage = (event) => {
        if (event.data === 'changed') onChange()
      }
      source.onerror = () => {
        source?.close()
        if (!stopped) retry = setTimeout(connect, 2000)
      }
    }

    connect()
    return () => {
      stopped = true
      source?.close()
      if (retry) clearTimeout(retry)
    }
  }, [onChange])
}
