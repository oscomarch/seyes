import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import type { Editor, Range } from '@tiptap/core'

export type SlashItem = { title: string; hint: string; run: (editor: Editor, range: Range) => void }

export const slashItems: SlashItem[] = [
  { title: 'Heading 1', hint: 'Big section title', run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run() },
  { title: 'Heading 2', hint: 'Medium section title', run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run() },
  { title: 'Heading 3', hint: 'Small section title', run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run() },
  { title: 'Bulleted list', hint: 'A simple list', run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: 'Numbered list', hint: 'A list with order', run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: 'To-do', hint: 'A list with checkboxes', run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: 'Toggle', hint: 'A collapsible section', run: (e, r) => e.chain().focus().deleteRange(r).insertContent({
      type: 'toggle',
      content: [
        { type: 'toggleSummary', content: [{ type: 'text', text: 'Toggle' }] },
        { type: 'paragraph' },
      ],
    }).run() },
  { title: 'Quote', hint: 'Set text apart', run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: 'Code block', hint: 'Monospaced block', run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: 'Divider', hint: 'A horizontal line', run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
]

/** Wires the `/` trigger. The popup itself is supplied by the caller. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-suggestion ships no exported type for its render() return shape
export function createSlashExtension(render: () => any) {
  return Extension.create({
    name: 'slashMenu',
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: '/',
          startOfLine: false,
          items: ({ query }: { query: string }) =>
            slashItems.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())).slice(0, 10),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SlashItem is passed through Suggestion's generic `props`, untyped here
          command: ({ editor, range, props }: any) => props.run(editor, range),
          render,
        }),
      ]
    },
  })
}
