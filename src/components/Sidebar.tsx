'use client'
import { useState } from 'react'
import type { TreeNode } from '@/lib/fs/tree'
import { NewNoteIcon, NewFolderIcon } from './icons'

type BranchProps = {
  nodes: TreeNode[]
  depth: number
  current: string | null
  onOpen: (path: string) => void
  onRefresh: () => void
}

function Branch({ nodes, depth, current, onOpen, onRefresh }: BranchProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  async function trash(node: TreeNode) {
    if (!window.confirm(`Move "${node.name}" to the Trash?`)) return
    await fetch('/api/trash', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: node.path }),
    })
    onRefresh()
  }

  async function rename(node: TreeNode) {
    const next = window.prompt('Rename to', node.name)
    if (!next || next.trim() === node.name) return
    const parent = node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/') + 1) : ''
    const to = node.type === 'folder' ? `${parent}${next.trim()}` : `${parent}${next.trim()}.md`
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: node.path, to }),
    })
    if (!response.ok) window.alert((await response.json()).error)
    onRefresh()
  }

  async function drop(event: React.DragEvent, node: TreeNode) {
    if (node.type !== 'folder') return
    event.preventDefault()
    event.stopPropagation()
    const from = event.dataTransfer.getData('text/plain')
    // Refuse a no-op, and refuse dropping a folder inside itself, which would
    // make the whole subtree unreachable.
    if (!from || from === node.path || node.path.startsWith(from + '/')) return
    const to = `${node.path}/${from.split('/').pop()}`
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from, to }),
    })
    if (!response.ok) window.alert((await response.json()).error)
    onRefresh()
  }

  return (
    <ul className="branch">
      {nodes.map((node) => (
        <li key={node.path}>
          <div
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', node.path)}
            onDragOver={(event) => {
              if (node.type === 'folder') event.preventDefault()
            }}
            onDrop={(event) => void drop(event, node)}
            className={`row ${node.type} ${current === node.path ? 'on' : ''}`}
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={() =>
              node.type === 'folder'
                ? setCollapsed((c) => ({ ...c, [node.path]: !c[node.path] }))
                : onOpen(node.path)
            }
          >
            <span className="caret">{node.type === 'folder' ? (collapsed[node.path] ? '>' : 'v') : ''}</span>
            <span className="name">{node.name}</span>
            {node.link && (
              <span className="linked" title="This is a link. The file lives somewhere else on disk.">
                ↗
              </span>
            )}
            <button
              className="rename"
              title="Rename"
              onClick={(event) => {
                event.stopPropagation()
                void rename(node)
              }}
            >
              ..
            </button>
            <button
              className="trash"
              title="Move to Trash"
              onClick={(event) => {
                event.stopPropagation()
                void trash(node)
              }}
            >
              x
            </button>
          </div>
          {node.type === 'folder' && !collapsed[node.path] && (
            <Branch
              nodes={node.children}
              depth={depth + 1}
              current={current}
              onOpen={onOpen}
              onRefresh={onRefresh}
            />
          )}
        </li>
      ))}
    </ul>
  )
}

export function Sidebar({
  tree,
  current,
  onOpen,
  onRefresh,
}: {
  tree: TreeNode[]
  current: string | null
  onOpen: (path: string) => void
  onRefresh: () => void
}) {
  async function create(kind: 'note' | 'folder') {
    // Trim: a trailing space in a folder name makes a real, confusing
    // directory on disk that is hard to spot and awkward to type.
    const name = kind === 'folder' ? window.prompt('Folder name')?.trim() : 'Untitled'
    if (kind === 'folder' && !name) return
    const response = await fetch('/api/note', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ folder: '', name, kind }),
    })
    const { path } = await response.json()
    onRefresh()
    if (kind === 'note' && path) onOpen(path)
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-head">
        <span className="wordmark">seyes</span>
        <div className="sidebar-actions">
          <button className="icon-button" onClick={() => void create('note')} title="New note">
            <NewNoteIcon title="New note" />
          </button>
          <button className="icon-button" onClick={() => void create('folder')} title="New folder">
            <NewFolderIcon title="New folder" />
          </button>
        </div>
      </div>
      <Branch nodes={tree} depth={0} current={current} onOpen={onOpen} onRefresh={onRefresh} />
    </nav>
  )
}
