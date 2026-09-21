'use client'
import { useEffect, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { browserExtensions } from '@/lib/editor/browserExtensions'
import { useAutosave } from '@/hooks/useAutosave'
import { BubbleToolbar } from './BubbleToolbar'

export function Editor({ path, onRename }: { path: string; onRename: (to: string) => void }) {
  const [markdown, setMarkdown] = useState('')
  const [loaded, setLoaded] = useState(false)
  const title = path.split('/').pop()!.replace(/\.md$/, '')

  const editor = useEditor({
    extensions: browserExtensions,
    content: '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'prose-body' } },
    onUpdate: ({ editor }) => setMarkdown(editor.storage.markdown.getMarkdown()),
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

  return (
    <main className="page">
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
