'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { Editor } from '@/components/Editor'
import { FontSwitcher } from '@/components/FontSwitcher'
import { CommandPalette } from '@/components/CommandPalette'
import type { TreeNode } from '@/lib/fs/tree'

export default function Home() {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [width, setWidth] = useState(250)
  const widthRef = useRef(250)
  widthRef.current = width

  const refresh = useCallback(async () => {
    const data = await fetch('/api/tree').then((r) => r.json())
    setTree(data.tree ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const stored = Number(window.localStorage.getItem('seyes-sidebar-width'))
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
          <FontSwitcher />
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
          <div className="empty">Pick a note, or make one.</div>
        )}
      </div>
      <CommandPalette onOpen={setCurrent} />
    </div>
  )
}
