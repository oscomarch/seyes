'use client'
import { useEffect, useRef, useState } from 'react'
import { DownIcon } from './icons'
import { pickFolder } from '@/lib/client/pickFolder'
import { notify } from '@/lib/client/notify'

type Folder = { path: string; display: string; name: string; icloud: boolean }
type Summary = { folder: Folder; recent: Folder[] }

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong.')
  return data
}

/**
 * The writing folder's name at the top of the sidebar. Clicking it says
 * where the writing lives and whether it leaves this Mac, and holds the three
 * things you do with a folder: look at it, move it, or swap it for another.
 *
 * After a switch or a move the page reloads. Everything on screen (the tree,
 * the open note, the live file watcher) belongs to the old folder, and a
 * clean start is simpler and safer than retargeting each piece.
 */
export function FolderSwitcher() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [open, setOpen] = useState(false)
  // Where the panel goes, measured from the button when it opens. The panel is
  // fixed to the window because the sidebar clips anything wider than itself.
  const [at, setAt] = useState({ top: 0, left: 0 })
  const [busy, setBusy] = useState<string | null>(null)
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onDown = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  async function run(label: string, action: () => Promise<boolean>) {
    setBusy(label)
    try {
      if (await action()) window.location.reload()
    } catch (error) {
      notify((error as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const reveal = () =>
    run('reveal', async () => {
      await post('/api/reveal', { path: '' })
      setOpen(false)
      return false
    })

  const move = () =>
    run('move', async () => {
      const into = await pickFolder(`Move your writing folder. Choose where "${summary?.folder.name}" should go.`)
      if (!into) return false
      await post('/api/folder/move', { into })
      return true
    })

  const openOther = () =>
    run('open', async () => {
      const root = await pickFolder('Choose a folder to write in.')
      if (!root) return false
      await post('/api/settings', { root })
      return true
    })

  const switchTo = (root: string) =>
    run(root, async () => {
      await post('/api/settings', { root })
      return true
    })

  const folder = summary?.folder

  return (
    <div className="folder-switcher" ref={anchor}>
      <button
        className={`folder-name ${open ? 'on' : ''}`}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          setAt({ top: box.bottom + 6, left: box.left })
          setOpen((value) => !value)
        }}
        title={folder ? `Your writing is in ${folder.display}` : undefined}
      >
        <span>{folder?.name ?? 'Seyes'}</span>
        <DownIcon />
      </button>

      {open && folder && (
        <div className="folder-panel" style={at}>
          <div className="folder-label">Your writing is in</div>
          <div className="folder-path">{folder.display}</div>
          <div className={`folder-where ${folder.icloud ? 'cloud' : ''}`}>
            {folder.icloud ? 'Syncs with iCloud' : 'Only on this Mac'}
          </div>

          <div className="folder-actions">
            <button onClick={() => void reveal()}>Show in Finder</button>
            <button onClick={() => void move()} disabled={busy === 'move'}>
              {busy === 'move' ? 'Moving…' : 'Move this folder…'}
            </button>
            <button onClick={() => void openOther()}>Open another folder…</button>
          </div>

          {summary.recent.length > 0 && (
            <>
              <div className="folder-label folder-recent-label">Recent</div>
              {summary.recent.map((entry) => (
                <button
                  key={entry.path}
                  className="folder-recent"
                  onClick={() => void switchTo(entry.path)}
                  title={entry.path}
                >
                  {entry.display}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
