import { Extension, type Editor } from '@tiptap/core'

const LISTS = new Set(['bulletList', 'orderedList', 'taskList'])
const ITEMS = ['listItem', 'taskItem'] as const

/** How many lists the caret is inside. 0 on a plain line, 1 in a top-level bullet. */
function listDepth(editor: Editor): number {
  const { $from } = editor.state.selection
  let depth = 0
  for (let d = $from.depth; d > 0; d--) if (LISTS.has($from.node(d).type.name)) depth++
  return depth
}

function indent(editor: Editor) {
  if (editor.isActive('codeBlock')) return editor.commands.insertContent('  ')
  if (listDepth(editor) > 0) {
    return ITEMS.some((item) => editor.can().sinkListItem(item) && editor.commands.sinkListItem(item))
  }
  // A plain line becomes a bullet, joining a list directly above it if there
  // is one. Headings, quotes and the rest stay what they are.
  if (editor.state.selection.$from.parent.type.name !== 'paragraph') return false
  return editor.commands.toggleBulletList()
}

function outdent(editor: Editor) {
  // One step back per press: a nested item moves out a level, and a
  // top-level item becomes a plain line again, undoing what Tab did to it.
  return ITEMS.some((item) => editor.can().liftListItem(item) && editor.commands.liftListItem(item))
}

/**
 * Tab and Shift+Tab: Tab makes a bullet, then indents it; Shift+Tab undoes each step.
 *
 * Tiptap's list items already bind Tab to indent, but when an item cannot be
 * indented (the first bullet of a list, or a plain line) the command fails,
 * no handler claims the key, and the browser moves focus to the next control
 * on the page. Writing, you press Tab and the caret vanishes. These handlers
 * always claim the key inside the editor, whether or not anything moved, so
 * Tab never leaves the page. They run ahead of the list items' own bindings.
 *
 * On a plain line Tab makes a bullet, rather than inserting a literal tab: in
 * markdown, a tab at the start of a line would turn the paragraph into a
 * code block. Shift+Tab walks every step back.
 */
export const ListIndent = Extension.create({
  name: 'listIndent',
  priority: 200,

  addKeyboardShortcuts() {
    const claim = (run: (editor: Editor) => boolean) => () => {
      run(this.editor)
      return true
    }
    return {
      Tab: claim(indent),
      'Shift-Tab': claim(outdent),
      'Mod-]': claim(indent),
      'Mod-[': claim(outdent),
    }
  },
})
