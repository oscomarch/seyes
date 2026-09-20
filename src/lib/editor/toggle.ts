import { Node, mergeAttributes } from '@tiptap/core'

/** The clickable title line of a toggle. Serialized as <summary>. */
export const ToggleSummary = Node.create({
  name: 'toggleSummary',
  content: 'inline*',
  parseHTML: () => [{ tag: 'summary' }],
  renderHTML: ({ HTMLAttributes }) => ['summary', mergeAttributes(HTMLAttributes), 0],
})

/**
 * A collapsible section. Markdown has no toggle, so this is the one block that
 * persists as HTML. <details> is valid HTML and renders collapsed in any
 * browser, so the file stays readable outside the app.
 */
export const Toggle = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'toggleSummary block+',
  defining: true,
  parseHTML: () => [{ tag: 'details' }],
  renderHTML: ({ HTMLAttributes }) => ['details', mergeAttributes(HTMLAttributes), 0],
  addStorage: () => ({
    markdown: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-markdown ships no exported types for its serializer state
      serialize(state: any, node: any) {
        state.write('<details>\n')
        state.write('<summary>' + (node.firstChild?.textContent ?? '') + '</summary>\n\n')
        // Render everything after the summary as normal markdown.
        state.renderContent(node.copy(node.content.cut(node.firstChild.nodeSize)))
        state.write('</details>')
        state.closeBlock(node)
      },
      parse: {},
    },
  }),
})
