'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { browserExtensions } from '@/lib/editor/browserExtensions'
import { useAutosave } from '@/hooks/useAutosave'
import { useLiveFolder } from '@/hooks/useLiveFolder'
import { BubbleToolbar } from './BubbleToolbar'

/**
 * While you are writing, the sidebar and topbar quietly recede, and they
 * come back when you stop. It is not a mode you turn on: the app simply
 * steps out of the way for as long as you are actually typing.
 */
let restTimer: ReturnType<typeof setTimeout> | null = null

function breathe() {
  document.documentElement.setAttribute('data-writing', '1')
  if (restTimer) clearTimeout(restTimer)
  restTimer = setTimeout(rest, 2400)
}

function rest() {
  if (restTimer) clearTimeout(restTimer)
  document.documentElement.removeAttribute('data-writing')
}

export function Editor({ path, onRename }: { path: string; onRename: (to: string) => void }) {
  const [markdown, setMarkdown] = useState('')
  const [loaded, setLoaded] = useState(false)
  const title = path.split('/').pop()!.replace(/\.md$/, '')

  const editor = useEditor({
    extensions: browserExtensions,
    content: '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose-body' } },
    onUpdate: ({ editor }) => {
      setMarkdown(editor.storage.markdown.getMarkdown())
      breathe()
    },
    onFocus: () => breathe(),
    onBlur: () => rest(),
  })

  useEffect(() => {
    let cancelled = false
    // Reset synchronously so a stale `loaded` flag from the previous path
    // can never let autosave fire against the new path before its content
    // arrives. eslint's newer compiler-oriented rule prefers deriving state
    // instead of setState-in-effect, but `loaded` here tracks an external
    // fetch, not a value derivable from props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false)
    fetch(`/api/note?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then(({ content }) => {
        if (cancelled || !editor) return
        editor.commands.setContent(editor.storage.markdown.parser.parse(content ?? ''))
        setMarkdown(content ?? '')
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [path, editor])

  // If this note changes on disk (edited elsewhere, synced, reverted), take
  // the new version, but never while the user is mid-edit: unsaved typing
  // always wins over what is on disk.
  const latest = useRef(markdown)
  // Latest-value ref, read only by the live-update handler below (which runs
  // from a server-sent event, never during render). Same pattern as the
  // sidebar width ref in page.tsx.
  // eslint-disable-next-line react-hooks/refs -- latest-value ref read outside render by the watch handler
  latest.current = markdown

  const adopt = useCallback(() => {
    if (!editor || !loaded || editor.isFocused) return
    fetch(`/api/note?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then(({ content }) => {
        if (typeof content !== 'string' || content === latest.current) return
        editor.commands.setContent(editor.storage.markdown.parser.parse(content))
        setMarkdown(content)
      })
      .catch(() => {})
  }, [editor, loaded, path])

  useLiveFolder(adopt)

  // Leaving a note should never leave the chrome faded out.
  useEffect(() => rest, [])

  const state = useAutosave(async () => {
    if (!loaded) return
    await fetch('/api/note', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, content: markdown }),
    })
  }, [markdown, loaded, path])

  async function renameTo(next: string) {
    const clean = next.trim()
    if (!clean || clean === title) return
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''
    const to = `${folder}${clean}.md`
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: path, to }),
    })
    if (response.ok) onRename(to)
  }

  // A leading H1 in the file is the document's own title, so the filename is
  // demoted to a quiet label rather than competing with it.
  const ownsItsTitle = /^\s*#\s+\S/.test(markdown)

  return (
    <main className="page">
      {ownsItsTitle ? (
        <div className="title-label" title={path}>
          {title}
        </div>
      ) : (
      <input
        className="title"
        defaultValue={title}
        key={path}
        onBlur={(e) => void renameTo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
            editor?.commands.focus('start')
          }
        }}
      />
      )}
      {editor && <BubbleToolbar editor={editor} />}
      <div className="sheet">
        <EditorContent editor={editor} />
      </div>
      <div className={`save-state save-state-${state}`}>
        {state === 'error' ? 'Not saved' : state === 'saving' ? 'Saving' : ''}
      </div>
    </main>
  )
}
