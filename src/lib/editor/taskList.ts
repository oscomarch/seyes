import { TaskList } from '@tiptap/extension-task-list'
import taskListPlugin from 'markdown-it-task-lists'

/**
 * tiptap-markdown injects a `tight` attribute into bulletList and orderedList
 * but NOT taskList, so task lists serialize with a blank line between every
 * item. Adding the attribute here is what keeps `- [ ] a\n- [ ] b` stable
 * across saves. The parse spec is copied from the library default: dropping it
 * would stop `- [ ]` being recognised at all, and the brackets would come back
 * escaped as literal text.
 */
export const SeyesTaskList = TaskList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tight: {
        default: true,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-tight') !== 'false',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-markdown ships no exported types for its serializer state
        renderHTML: (attributes: Record<string, any>) => ({
          'data-tight': attributes.tight ? 'true' : null,
        }),
      },
    }
  },
  addStorage: () => ({
    markdown: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-markdown ships no exported types for its serializer state
      serialize(state: any, node: any) {
        state.renderList(node, '  ', () => '- ')
      },
      parse: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- markdown-it ships no usable types here
        setup(markdownit: any) {
          markdownit.use(taskListPlugin)
        },
        updateDOM(element: HTMLElement) {
          element.querySelectorAll('.contains-task-list').forEach((list) => {
            list.setAttribute('data-type', 'taskList')
          })
        },
      },
    },
  }),
})
