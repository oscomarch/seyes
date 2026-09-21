'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { Editor } from '@/components/Editor'
import { Desk } from '@/components/Desk'
import { Settings } from '@/components/Settings'
import { useLiveFolder } from '@/hooks/useLiveFolder'
import { PanelToggleIcon } from '@/components/icons'
import { CommandPalette } from '@/components/CommandPalette'
import type { TreeNode } from '@/lib/fs/tree'

export default function Home() {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [width, setWidth] = useState(250)
  const widthRef = useRef(250)
  // startResize below registers native mousemove/mouseup listeners outside
  // React's render cycle; they need the latest width without re-subscribing
  // on every drag tick, so this ref is kept in sync during render rather
  // than through an effect (which would lag a render behind).
  // eslint-disable-next-line react-hooks/refs -- latest-value ref read by native listeners added in startResize, not by render
  widthRef.current = width

  const [pulse, setPulse] = useState(0)
  // Serialized copy of the last tree we rendered. Writing a note fires a
  // watch event, but the tree itself is usually unchanged, so this avoids
  // re-rendering the whole sidebar on every autosave.
  const lastTree = useRef('')

  const refresh = useCallback(async () => {
    const data = await fetch('/api/tree').then((r) => r.json())
    const next = JSON.stringify(data.tree ?? [])
    if (next === lastTree.current) return
    lastTree.current = next
    setTree(data.tree ?? [])
    setPulse((n) => n + 1)
  }, [])

  // The folder is the source of truth, so the app follows it rather than
  // assuming it is the only thing writing there.
  useLiveFolder(refresh)

  useEffect(() => {
    // Initial data fetch on mount: synchronizing with the external
    // filesystem via /api/tree, not a render-driven cascade.
    void refresh()
  }, [refresh])

  useEffect(() => {
    // One-time read from localStorage on mount, mirroring the same pattern
    // used in FontSwitcher: localStorage is only reachable after mount.
    const stored = Number(window.localStorage.getItem('seyes-sidebar-width'))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from localStorage on mount, not a render-triggered cascade
    if (stored >= 180 && stored <= 520) setWidth(stored)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault()
        setSidebarOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function startResize(event: React.MouseEvent) {
    event.preventDefault()
    const move = (e: MouseEvent) => setWidth(Math.min(520, Math.max(180, e.clientX)))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      window.localStorage.setItem('seyes-sidebar-width', String(widthRef.current))
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div className="shell">
      {sidebarOpen && (
        <>
          <div className="sidebar-slot" style={{ width }}>
            <Sidebar tree={tree} current={current} onOpen={setCurrent} onRefresh={() => void refresh()} />
          </div>
          <div className="resizer" onMouseDown={startResize} />
        </>
      )}
      <div className="main">
        <header className="topbar">
          <button
            className="icon-button"
            onClick={() => setSidebarOpen((value) => !value)}
            title={sidebarOpen ? 'Hide sidebar (cmd+\\)' : 'Show sidebar (cmd+\\)'}
          >
            <PanelToggleIcon title="Toggle sidebar" />
          </button>
          <Settings path={current} />
        </header>
        {current ? (
          <Editor
            path={current}
            onRename={(to) => {
              setCurrent(to)
              void refresh()
            }}
          />
        ) : (
          <Desk
            reloadKey={pulse}
            onOpen={setCurrent}
            onNew={async () => {
              const response = await fetch('/api/note', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ folder: '', name: 'Untitled', kind: 'note' }),
              })
              const { path } = await response.json()
              if (path) setCurrent(path)
              void refresh()
            }}
          />
        )}
      </div>
      <CommandPalette onOpen={setCurrent} />
    </div>
  )
}
