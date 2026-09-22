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
  return ITEMS.some((item) => editor.can().sinkListItem(item) && editor.commands.sinkListItem(item))
}

function outdent(editor: Editor) {
  // At the top level, lifting would turn the bullet into a plain paragraph.
  // Backspace at the start of the line already does that; Shift+Tab should
  // only ever move an item out one level, never out of the list.
  if (listDepth(editor) < 2) return false
  return ITEMS.some((item) => editor.can().liftListItem(item) && editor.commands.liftListItem(item))
}

/**
 * Tab and Shift+Tab, the way Notion and Apple Notes do them.
 *
 * Tiptap's list items already bind Tab to indent, but when an item cannot be
 * indented (the first bullet of a list, or a plain line) the command fails,
 * no handler claims the key, and the browser moves focus to the next control
 * on the page. Writing, you press Tab and the caret vanishes. These handlers
 * always claim the key inside the editor, whether or not anything moved, so
 * Tab never leaves the page. They run ahead of the list items' own bindings.
 *
 * A plain line gets nothing rather than a literal tab: in markdown, a tab at
 * the start of a line turns the paragraph into a code block.
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
