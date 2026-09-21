'use client'
import { useEffect, useState } from 'react'

type RecentNote = {
  path: string
  name: string
  folder: string
  modified: string
  excerpt: string
  words: number
}

type DeskData = { recent: RecentNote[]; totals: { notes: number; words: number } }

/** "just now", "14 minutes ago", "yesterday", "3 days ago", then a date. */
function ago(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.floor((Date.now() - then) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(then).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

export function Desk({
  onOpen,
  onNew,
  reloadKey,
}: {
  onOpen: (path: string) => void
  onNew: () => void
  reloadKey: number
}) {
  const [data, setData] = useState<DeskData | null>(null)
  const [firstTime, setFirstTime] = useState(false)

  useEffect(() => {
    const seen = window.localStorage.getItem('seyes-seen')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage on mount
    if (!seen) setFirstTime(true)
    window.localStorage.setItem('seyes-seen', '1')
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/desk')
      .then((r) => r.json())
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  if (firstTime) {
    return (
      <div className="desk">
        <div className="desk-sheet">
          <h1 className="desk-title">Welcome to Seyes.</h1>
          <p className="desk-lede">
            Everything you write here is a plain markdown file in a folder on this computer. No
            account, no cloud, no lock-in. Delete Seyes tomorrow and your writing is still sitting
            there, readable in any editor.
          </p>
          <dl className="desk-keys">
            <dt>/</dt>
            <dd>headings, lists, to-dos, toggles, quotes</dd>
            <dt>⌘B ⌘I ⌘U</dt>
            <dd>bold, italic, underline. Or just select text.</dd>
            <dt>⌘K</dt>
            <dd>search everything you have written</dd>
            <dt>⌘\</dt>
            <dd>hide the sidebar and disappear into it</dd>
          </dl>
          <button className="desk-start" onClick={onNew}>
            Start writing
          </button>
          <p className="desk-note">
            The settings gear, top right, shows exactly where each note lives on disk.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="desk">
      <div className="desk-sheet">
        <div className="desk-date">
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </div>
        <h1 className="desk-title">{greeting()}.</h1>

        {data && data.totals.notes > 0 ? (
          <>
            <p className="desk-lede">
              {data.totals.notes} note{data.totals.notes === 1 ? '' : 's'},{' '}
              {data.totals.words.toLocaleString()} word{data.totals.words === 1 ? '' : 's'} so far.
            </p>

            <div className="desk-label">Where you left off</div>
            <ul className="desk-recent">
              {data.recent.map((note) => (
                <li key={note.path} onClick={() => onOpen(note.path)}>
                  <div className="desk-row">
                    <span className="desk-name">{note.name}</span>
                    <span className="desk-when">{ago(note.modified)}</span>
                  </div>
                  {note.excerpt && <div className="desk-excerpt">{note.excerpt}</div>}
                  {note.folder && <div className="desk-folder">{note.folder}</div>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="desk-lede">Nothing written yet. That is the fun part.</p>
        )}

        <button className="desk-start" onClick={onNew}>
          New note
        </button>
      </div>
    </div>
  )
}
