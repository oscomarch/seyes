'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TreeNode } from '@/lib/fs/tree'
import { ChevronIcon, DotsIcon, FolderIcon, PencilIcon } from './icons'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { FolderSwitcher } from './FolderSwitcher'
import { notify } from '@/lib/client/notify'
import { markFresh } from '@/lib/client/fresh'

type Menu = { x: number; y: number; node: TreeNode | null }

const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

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

/** Renames in place, the way Finder does. Enter commits, Escape cancels. */
function RenameField({ node, onDone }: { node: TreeNode; onDone: (renamedTo?: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const committed = useRef(false)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  async function commit() {
    if (committed.current) return
    committed.current = true
    const next = input.current?.value.trim() ?? ''
    if (!next || next === node.name) return onDone()
    const parent = parentOf(node.path)
    const to = `${parent ? parent + '/' : ''}${next}${node.type === 'note' ? '.md' : ''}`
    try {
      await post('/api/move', { from: node.path, to })
      onDone(to)
    } catch (error) {
      notify((error as Error).message, 'error')
      onDone()
    }
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

type RowProps = {
  nodes: TreeNode[]
  depth: number
  current: string | null
  pickedFolder: string | null
  editing: string | null
  collapsed: Record<string, boolean>
  dropTarget: string | null
  onToggle: (path: string) => void
  onOpen: (path: string) => void
  onSelectFolder: (path: string) => void
  onMenu: (menu: Menu) => void
  onRename: (path: string) => void
  onRenamed: (node: TreeNode, to?: string) => void
  onDrag: (path: string | null) => void
  onDrop: (from: string, folder: string) => void
}

function Branch(props: RowProps) {
  const { nodes, depth, current, pickedFolder, editing, collapsed, dropTarget } = props

  return (
    <ul className="branch">
      {nodes.map((node) => {
        const isFolder = node.type === 'folder'
        const isOpen = isFolder && !collapsed[node.path]
        const classes = [
          'row',
          node.type,
          current === node.path ? 'on' : '',
          isFolder && pickedFolder === node.path ? 'target' : '',
          dropTarget === node.path ? 'drop' : '',
        ].join(' ')

        return (
          <li key={node.path}>
            <div
              className={classes}
              style={{ paddingLeft: 8 + depth * 16 }}
              draggable={editing !== node.path}
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', node.path)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
                if (!isFolder) return
                event.preventDefault()
                event.stopPropagation()
                props.onDrag(node.path)
              }}
              onDragLeave={() => props.onDrag(null)}
              onDrop={(event) => {
                if (!isFolder) return
                event.preventDefault()
                event.stopPropagation()
                props.onDrop(event.dataTransfer.getData('text/plain'), node.path)
              }}
              onClick={() => {
                if (isFolder) {
                  props.onToggle(node.path)
                  props.onSelectFolder(node.path)
                } else {
                  props.onOpen(node.path)
                }
              }}
              onDoubleClick={(event) => {
                if (isFolder) return
                event.stopPropagation()
                props.onRename(node.path)
              }}
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                props.onMenu({ x: event.clientX, y: event.clientY, node })
              }}
            >
              <span className="row-lead">{isFolder && <ChevronIcon open={isOpen} />}</span>
              {/* Notes get an empty slot where a folder has its icon, so names
                  at the same depth line up and nesting reads at a glance. */}
              <span className="row-icon">{isFolder && <FolderIcon />}</span>

              {editing === node.path ? (
                <RenameField node={node} onDone={(to) => props.onRenamed(node, to)} />
              ) : (
                <>
                  <span className="name">{node.name}</span>
                  {node.link && (
                    <span className="linked" title="This is a link. The file lives somewhere else on disk.">
                      ↗
                    </span>
                  )}
                  <button
                    className="row-more"
                    title="More"
                    onClick={(event) => {
                      event.stopPropagation()
                      const box = event.currentTarget.getBoundingClientRect()
                      props.onMenu({ x: box.left, y: box.bottom + 2, node })
                    }}
                  >
                    <DotsIcon title="More" />
                  </button>
                </>
              )}
            </div>

            {isOpen && node.children.length > 0 && <Branch {...props} nodes={node.children} depth={depth + 1} />}
          </li>
        )
      })}
    </ul>
  )
}

export function Sidebar({
  tree,
  current,
  onOpen,
  onClose,
  onRefresh,
}: {
  tree: TreeNode[]
  current: string | null
  onOpen: (path: string) => void
  onClose: () => void
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [picked, setPicked] = useState<{ folder: string; during: string | null }>({ folder: '', during: null })
  const [menu, setMenu] = useState<Menu | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  // New notes land where you last were: the folder you just clicked, or else
  // the open note's folder. A click on a folder counts until another note is
  // opened, from anywhere (the tree, search, the desk).
  const folderPicked = picked.during === current
  const target = folderPicked ? picked.folder : current ? parentOf(current) : ''
  const targetName = target ? target.split('/').pop() : null

  const expand = (folder: string) =>
    setCollapsed((all) => {
      const next = { ...all }
      for (let at = folder; at; at = parentOf(at)) delete next[at]
      return next
    })

  const create = useCallback(
    async (kind: 'note' | 'folder', folder: string) => {
      try {
        const { path } = await post('/api/note', {
          folder,
          name: kind === 'folder' ? 'New folder' : 'Untitled',
          kind,
        })
        expand(folder)
        onRefresh()
        if (kind === 'note') {
          markFresh(path)
          onOpen(path)
        }
        else setEditing(path)
      } catch (error) {
        notify((error as Error).message, 'error')
      }
    },
    [onOpen, onRefresh],
  )

  // ⌘N and ⇧⌘N. A browser keeps ⌘N for a new window, so these work in the
  // Mac app; the button is always there either way.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'n') return
      event.preventDefault()
      void create(event.shiftKey ? 'folder' : 'note', target)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [create, target])

  async function trash(node: TreeNode) {
    // Close the note first if it is going away, or its next autosave would
    // write it straight back out of the Trash.
    if (current === node.path || current?.startsWith(node.path + '/')) onClose()
    try {
      await post('/api/trash', { path: node.path })
      notify(`Moved "${node.name}" to the Trash`)
      onRefresh()
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }

  async function move(from: string, folder: string) {
    setDropTarget(null)
    // Nothing to do, or a folder dropped into itself, which would make the
    // whole subtree unreachable.
    if (!from || parentOf(from) === folder || folder === from || folder.startsWith(from + '/')) return
    const to = `${folder ? folder + '/' : ''}${from.split('/').pop()}`
    try {
      await post('/api/move', { from, to })
      expand(folder)
      if (current === from) onOpen(to)
      onRefresh()
    } catch (error) {
      notify((error as Error).message, 'error')
    }
  }

  function itemsFor(node: TreeNode | null): MenuItem[] {
    if (!node) {
      return [
        { label: 'New note', hint: '⌘N', onSelect: () => void create('note', '') },
        { label: 'New folder', hint: '⇧⌘N', onSelect: () => void create('folder', '') },
      ]
    }
    const reveal = { label: 'Show in Finder', onSelect: () => void post('/api/reveal', { path: node.path }) }
    const rename = { label: 'Rename', onSelect: () => setEditing(node.path) }
    const remove = { label: 'Move to Trash', danger: true, onSelect: () => void trash(node) }
    if (node.type === 'folder') {
      return [
        { label: 'New note here', onSelect: () => void create('note', node.path) },
        { label: 'New folder here', onSelect: () => void create('folder', node.path) },
        'separator',
        rename,
        reveal,
        'separator',
        remove,
      ]
    }
    return [rename, reveal, 'separator', remove]
  }

  return (
    <nav
      className="sidebar"
      onContextMenu={(event) => {
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY, node: null })
      }}
    >
      <div className="sidebar-head">
        <FolderSwitcher />
      </div>

      <div className="sidebar-new">
        <button
          className="new-note"
          onClick={() => void create('note', target)}
          title={targetName ? `New note in ${targetName}` : 'New note'}
        >
          <PencilIcon />
          <span>New note</span>
          <kbd>⌘N</kbd>
        </button>
      </div>

      <div
        className={`tree ${dropTarget === '' ? 'drop' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDropTarget('')
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null)
        }}
        onDrop={(event) => {
          event.preventDefault()
          void move(event.dataTransfer.getData('text/plain'), '')
        }}
      >
        {tree.length === 0 ? (
          <p className="tree-empty">Nothing here yet. Your notes will show up as you write them.</p>
        ) : (
          <Branch
            nodes={tree}
            depth={0}
            current={current}
            pickedFolder={folderPicked ? picked.folder : null}
            editing={editing}
            collapsed={collapsed}
            dropTarget={dropTarget}
            onToggle={(path) => setCollapsed((all) => ({ ...all, [path]: !all[path] }))}
            onOpen={onOpen}
            onSelectFolder={(folder) => setPicked({ folder, during: current })}
            onMenu={setMenu}
            onRename={setEditing}
            onRenamed={(node, to) => {
              setEditing(null)
              if (to && current === node.path) onOpen(to)
              if (to && current?.startsWith(node.path + '/')) onOpen(to + current.slice(node.path.length))
              onRefresh()
            }}
            onDrag={setDropTarget}
            onDrop={(from, folder) => void move(from, folder)}
          />
        )}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={itemsFor(menu.node)} onClose={closeMenu} />
      )}
    </nav>
  )
}
