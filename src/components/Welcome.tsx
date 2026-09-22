'use client'
import { useState } from 'react'
import { pickFolder } from '@/lib/client/pickFolder'

type Folder = { path: string; display: string; name: string; icloud: boolean }

/**
 * The first launch. Seyes asks one thing, where the writing should live,
 * suggests a folder that stays on this Mac, and gets out of the way.
 */
export function Welcome({ suggested, onDone }: { suggested: Folder; onDone: () => void }) {
  const [choice, setChoice] = useState<Folder>(suggested)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function choose() {
    setError(null)
    try {
      const picked = await pickFolder('Choose a folder for your writing.')
      if (!picked) return
      const home = suggested.path.slice(0, suggested.path.lastIndexOf('/'))
      const display = picked.startsWith(home + '/') ? `~${picked.slice(home.length)}` : picked
      // Whether a hand-picked folder syncs with iCloud is only known to the
      // server; it says so on the next screen, in the folder panel.
      setChoice({ path: picked, display, name: picked.split('/').pop() || picked, icloud: false })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ root: choice.path }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Something went wrong.')
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-sheet">
        <h1>seyes</h1>
        <p className="welcome-lede">A place to write, on your own computer.</p>
        <p>
          Everything you write is saved as a plain text file in a folder you choose. No account, no cloud. If you stop
          using Seyes, your writing stays right where it is.
        </p>

        <div className="welcome-label">Your writing will live in</div>
        <div className="welcome-folder">
          <code>{choice.display}</code>
          <button onClick={() => void choose()}>Choose another…</button>
        </div>
        <div className={`folder-where ${choice.icloud ? 'cloud' : ''}`}>
          {choice.icloud ? 'Syncs with iCloud' : choice.path === suggested.path ? 'Only on this Mac' : 'The folder you picked'}
        </div>

        {error && <p className="welcome-error">{error}</p>}

        <button className="welcome-start" onClick={() => void start()} disabled={busy}>
          {busy ? 'Setting up…' : 'Start writing'}
        </button>
      </div>
    </div>
  )
}
