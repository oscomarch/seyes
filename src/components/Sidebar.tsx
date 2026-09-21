'use client'
import { useEffect, useRef, useState } from 'react'
import type { TreeNode } from '@/lib/fs/tree'
import { NewNoteIcon, NewFolderIcon } from './icons'

type BranchProps = {
  nodes: TreeNode[]
  depth: number
  current: string | null
  editing: string | null
  onEdit: (path: string | null) => void
  onOpen: (path: string) => void
  onRefresh: () => void
}

/** Renames in place, the way Finder does. Enter commits, Escape cancels. */
function RenameField({
  node,
  onDone,
}: {
  node: TreeNode
  onDone: (renamedTo?: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const committed = useRef(false)

  useEffect(() => {
    const field = input.current
    if (!field) return
    field.focus()
    // Select the name but not the extension, again like Finder.
    field.setSelectionRange(0, field.value.length)
  }, [])

  async function commit() {
    if (committed.current) return
    committed.current = true

    const next = input.current?.value.trim() ?? ''
    if (!next || next === node.name) return onDone()

    const parent = node.path.includes('/') ? node.path.slice(0, node.path.lastIndexOf('/') + 1) : ''
    const to = node.type === 'folder' ? `${parent}${next}` : `${parent}${next}.md`

    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: node.path, to }),
    })
    if (!response.ok) {
      window.alert((await response.json()).error)
      return onDone()
    }
    onDone(to)
  }

  return (
    <input
      ref={input}
      className="row-rename"
      defaultValue={node.name}
      onClick={(event) => event.stopPropagation()}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') {
          event.preventDefault()
          void commit()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          committed.current = true
          onDone()
        }
      }}
    />
  )
}

function Branch({ nodes, depth, current, editing, onEdit, onOpen, onRefresh }: BranchProps) {
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
            draggable={editing !== node.path}
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
            onDoubleClick={(event) => {
              event.stopPropagation()
              onEdit(node.path)
            }}
          >
            <span className="caret">{node.type === 'folder' ? (collapsed[node.path] ? '>' : 'v') : ''}</span>

            {editing === node.path ? (
              <RenameField
                node={node}
                onDone={(renamedTo) => {
                  onEdit(null)
                  if (renamedTo && node.type === 'note' && current === node.path) onOpen(renamedTo)
                  onRefresh()
                }}
              />
            ) : (
              <>
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
                    onEdit(node.path)
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
              </>
            )}
          </div>

          {node.type === 'folder' && !collapsed[node.path] && (
            <Branch
              nodes={node.children}
              depth={depth + 1}
              current={current}
              editing={editing}
              onEdit={onEdit}
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
  const [editing, setEditing] = useState<string | null>(null)

  /**
   * New folders are created with a placeholder name and immediately put into
   * rename mode, so naming one is typing rather than answering a dialog.
   */
  async function create(kind: 'note' | 'folder') {
    const response = await fetch('/api/note', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ folder: '', name: kind === 'folder' ? 'New folder' : 'Untitled', kind }),
    })
    const { path } = await response.json()
    onRefresh()
    if (!path) return
    if (kind === 'note') onOpen(path)
    else setEditing(path)
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
      <Branch
        nodes={tree}
        depth={0}
        current={current}
        editing={editing}
        onEdit={setEditing}
        onOpen={onOpen}
        onRefresh={onRefresh}
      />
    </nav>
  )
}
