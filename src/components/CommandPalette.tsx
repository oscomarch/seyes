'use client'
import { useEffect, useRef, useState } from 'react'
import type { SearchHit } from '@/lib/fs/search'

export function CommandPalette({ onOpen }: { onOpen: (path: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) input.current?.focus()
    // Resetting the query when the palette closes is synchronizing local UI
    // state with the `open` toggle (an external-ish trigger: a keyboard
    // shortcut or backdrop click), not a render-driven cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears query on close, driven by the open toggle, not by render output
    else setQuery('')
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      // Clearing stale hits when the query empties out is synchronizing
      // with the debounced fetch below, not a render-triggered cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears hits for an empty query, mirrors the debounced fetch's own setHits call
      setHits([])
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => setHits(data.hits ?? []))
    }, 120)
    return () => clearTimeout(timer)
  }, [query])

  if (!open) return null

  return (
    <div className="palette-backdrop" onClick={() => setOpen(false)}>
      <div className="palette" onClick={(event) => event.stopPropagation()}>
        <input
          ref={input}
          value={query}
          placeholder="Search your writing"
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul>
          {hits.map((hit) => (
            <li
              key={hit.path}
              onClick={() => {
                onOpen(hit.path)
                setOpen(false)
              }}
            >
              <span className="hit-name">{hit.name}</span>
              <span className="hit-excerpt">{hit.excerpt}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
