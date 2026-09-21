'use client'
import { useEffect, useRef, useState } from 'react'
import { SettingsIcon } from './icons'
import { useTheme, type ThemeChoice } from '@/hooks/useTheme'
import { useRuledPaper } from '@/hooks/useRuledPaper'

const FONTS = {
  courier: { label: 'Courier', stack: '"Courier New", Courier, monospace' },
  verdana: { label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  georgia: { label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
} as const

type FontKey = keyof typeof FONTS

type Meta = {
  path: string
  created: string
  modified: string
  bytes: number
  words: number
}

/** "20 Sept 2026, 17:42" rather than a raw ISO string. */
function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string; style?: React.CSSProperties }>
  value: T
  onChange: (key: T) => void
}) {
  return (
    <div className="seg">
      {options.map((option) => (
        <button
          key={option.key}
          style={option.style}
          className={value === option.key ? 'on' : ''}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Settings({ path }: { path: string | null }) {
  const [open, setOpen] = useState(false)
  const [font, setFont] = useState<FontKey>('courier')
  const [meta, setMeta] = useState<Meta | null>(null)
  const [copied, setCopied] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const { ruled, setRuled } = useRuledPaper()

  useEffect(() => {
    const stored = window.localStorage.getItem('seyes-font') as FontKey | null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage on mount
    if (stored && stored in FONTS) setFont(stored)
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--writing-font', FONTS[font].stack)
    window.localStorage.setItem('seyes-font', font)
  }, [font])

  // Close on Escape, and on any click outside the panel.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onDown = (event: MouseEvent) => {
      if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  // Metadata is read fresh each time the panel opens, so "last updated" is
  // never a stale value cached from an earlier save.
  useEffect(() => {
    if (!open || !path) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears derived state when the panel closes
      setMeta(null)
      return
    }
    let cancelled = false
    fetch(`/api/meta?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && !data.error) setMeta(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, path])

  async function reveal() {
    if (!path) return
    await fetch('/api/reveal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    })
  }

  async function copyPath() {
    if (!meta) return
    try {
      await navigator.clipboard.writeText(meta.path)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="settings-anchor" ref={panel}>
      <button
        className={`icon-button ${open ? 'on' : ''}`}
        onClick={() => setOpen((value) => !value)}
        title="Settings"
      >
        <SettingsIcon title="Settings" />
      </button>

      {open && (
        <div className="settings-panel">
          <div className="settings-section">
            <div className="settings-label">Appearance</div>

            <div className="settings-row">
              <span>Theme</span>
              <Segmented<ThemeChoice>
                value={theme}
                onChange={setTheme}
                options={[
                  { key: 'light', label: 'Light' },
                  { key: 'dark', label: 'Dark' },
                  { key: 'system', label: 'Auto' },
                ]}
              />
            </div>

            <div className="settings-row">
              <span>Font</span>
              <Segmented<FontKey>
                value={font}
                onChange={setFont}
                options={(Object.keys(FONTS) as FontKey[]).map((key) => ({
                  key,
                  label: FONTS[key].label,
                  style: { fontFamily: FONTS[key].stack },
                }))}
              />
            </div>

            <div className="settings-row">
              <span>Ruled paper</span>
              <Segmented<'on' | 'off'>
                value={ruled ? 'on' : 'off'}
                onChange={(key) => setRuled(key === 'on')}
                options={[
                  { key: 'on', label: 'On' },
                  { key: 'off', label: 'Off' },
                ]}
              />
            </div>
          </div>

          {path && (
            <div className="settings-section">
              <div className="settings-label">This note</div>

              {meta ? (
                <>
                  <div className="settings-path">
                    <code>{meta.path}</code>
                    <button onClick={() => void copyPath()}>{copied ? 'Copied' : 'Copy'}</button>
                    <button onClick={() => void reveal()} title="Show this file in Finder">
                      Open
                    </button>
                  </div>
                  <dl className="settings-facts">
                    <dt>Created</dt>
                    <dd>{when(meta.created)}</dd>
                    <dt>Last updated</dt>
                    <dd>{when(meta.modified)}</dd>
                    <dt>Words</dt>
                    <dd>{meta.words.toLocaleString()}</dd>
                    <dt>Size</dt>
                    <dd>{meta.bytes.toLocaleString()} bytes</dd>
                  </dl>
                </>
              ) : (
                <div className="settings-waiting">Reading the file…</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
