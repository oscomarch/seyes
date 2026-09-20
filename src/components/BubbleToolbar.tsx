'use client'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'

const actions = [
  { label: 'B', title: 'Bold', mark: 'bold', run: (e: Editor) => e.chain().focus().toggleBold().run() },
  { label: 'i', title: 'Italic', mark: 'italic', run: (e: Editor) => e.chain().focus().toggleItalic().run() },
  { label: 'U', title: 'Underline', mark: 'underline', run: (e: Editor) => e.chain().focus().toggleUnderline().run() },
  { label: 'S', title: 'Strikethrough', mark: 'strike', run: (e: Editor) => e.chain().focus().toggleStrike().run() },
  { label: 'H', title: 'Highlight', mark: 'highlight', run: (e: Editor) => e.chain().focus().toggleHighlight().run() },
  { label: '<>', title: 'Code', mark: 'code', run: (e: Editor) => e.chain().focus().toggleCode().run() },
]

export function BubbleToolbar({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu editor={editor} className="bubble">
      {actions.map((action) => (
        <button
          key={action.mark}
          title={action.title}
          className={editor.isActive(action.mark) ? 'on' : ''}
          onClick={() => action.run(editor)}
        >
          {action.label}
        </button>
      ))}
      <button
        title="Link"
        className={editor.isActive('link') ? 'on' : ''}
        onClick={() => {
          const url = window.prompt('Link to')
          if (url) editor.chain().focus().setLink({ href: url }).run()
          else editor.chain().focus().unsetLink().run()
        }}
      >
        link
      </button>
    </BubbleMenu>
  )
}
