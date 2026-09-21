'use client'
import { useEffect, useRef } from 'react'

/**
 * One live connection for the whole app.
 *
 * Several components care when the folder changes (the sidebar, the desk,
 * the open note), and the obvious implementation gives each of them its own
 * stream, which means several sockets and several filesystem watchers on the
 * server doing identical work. Instead there is a single stream here, shared
 * by every subscriber, opened when the first one arrives and closed when the
 * last one leaves.
 */
const subscribers = new Set<() => void>()
let stream: EventSource | null = null
let retry: ReturnType<typeof setTimeout> | null = null

function open() {
  if (stream) return
  stream = new EventSource('/api/watch')
  stream.onmessage = (event) => {
    if (event.data === 'changed') for (const notify of subscribers) notify()
  }
  stream.onerror = () => {
    stream?.close()
    stream = null
    // Only worth reconnecting while somebody is still listening.
    if (subscribers.size > 0 && !retry) {
      retry = setTimeout(() => {
        retry = null
        open()
      }, 2000)
    }
  }
}

function close() {
  stream?.close()
  stream = null
  if (retry) {
    clearTimeout(retry)
    retry = null
  }
}

/**
 * Calls `onChange` whenever anything in the writing folder changes on disk,
 * including edits made outside Seyes.
 *
 * `onChange` is held in a ref rather than listed as a dependency. Callers
 * naturally pass a closure over their current state, which would be a new
 * function on every keystroke; depending on it directly tore the stream down
 * and opened a fresh one with every character typed.
 */
export function useLiveFolder(onChange: () => void) {
  const handler = useRef(onChange)
  // Latest-value ref, read only from the server-sent event handler, never
  // during render. This is the whole point of the hook: the stream must not
  // be torn down just because the caller re-rendered.
  // eslint-disable-next-line react-hooks/refs -- latest-value ref read by the event handler, not by render
  handler.current = onChange

  useEffect(() => {
    const notify = () => handler.current()
    subscribers.add(notify)
    open()

    return () => {
      subscribers.delete(notify)
      if (subscribers.size === 0) close()
    }
  }, [])
}
