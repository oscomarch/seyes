import StarterKit from '@tiptap/starter-kit'
import { Highlight } from '@tiptap/extension-highlight'
import { TaskItem } from '@tiptap/extension-task-item'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Markdown, type MarkdownStorage } from 'tiptap-markdown'
import { Toggle, ToggleSummary } from './toggle'
import { SeyesTaskList } from './taskList'
import { ListIndent } from './indent'

// tiptap-markdown's own MarkdownStorage type omits `parser`, and @tiptap/core's
// `Storage` interface is intentionally empty for extensions to augment. This
// is the standard Tiptap module-augmentation pattern, not a type-modelling
// exercise: it just tells `editor.storage.markdown` what tiptap-markdown adds.
declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage & {
      parser: { parse(content: string): string }
    }
  }
}

/**
 * The single source of truth for what Seyes can express.
 * Underline and Link ship inside StarterKit v3, so they are not listed
 * separately. Underline persists as <u> and Highlight as <mark> through
 * tiptap-markdown's html passthrough, with no custom code needed.
 */
export const seyesExtensions = [
  StarterKit,
  Highlight,
  SeyesTaskList,
  TaskItem.configure({ nested: true }),
  ListIndent,
  Toggle,
  ToggleSummary,
  Placeholder.configure({ placeholder: 'Write.' }),
  Markdown.configure({ html: true, tightLists: true, bulletListMarker: '-' }),
]
