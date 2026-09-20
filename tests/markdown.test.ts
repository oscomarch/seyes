import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Editor } from '@tiptap/core'
import { seyesExtensions } from '@/lib/editor/extensions'

let editor: Editor

beforeAll(() => {
  editor = new Editor({ extensions: seyesExtensions, content: '' })
})
afterAll(() => editor.destroy())

function roundTrip(markdown: string): string {
  editor.commands.setContent(editor.storage.markdown.parser.parse(markdown))
  return editor.storage.markdown.getMarkdown().trim()
}

const cases: Record<string, string> = {
  heading: '# Title\n\n## Sub',
  bold: 'a **bold** b',
  italic: 'a *italic* b',
  strike: 'a ~~struck~~ b',
  code: 'a `code` b',
  link: 'a [text](https://x.com) b',
  bullet: '- one\n- two',
  ordered: '1. one\n2. two',
  nested: '- one\n  - nested\n- two',
  quote: '> quoted',
  codeblock: '```js\nconst a = 1\n```',
  divider: '---',
  todo: '- [ ] undone\n- [x] done',
  underline: 'a <u>under</u> b',
  highlight: 'a <mark>hi</mark> b',
  toggle: '<details>\n<summary>Title</summary>\n\nBody text\n\n</details>',
  toggleRich: '<details>\n<summary>Plans</summary>\n\n- one\n- two\n\n</details>',
  journal:
    '# 20 Sept\n\nWoke up *early*. Felt <mark>good</mark>.\n\n- [x] wrote\n- [ ] ran\n\n> quiet morning',
}

describe('markdown round-trip', () => {
  for (const [name, markdown] of Object.entries(cases)) {
    it(`preserves ${name} byte-identically`, () => {
      expect(roundTrip(markdown)).toBe(markdown.trim())
    })
  }

  it('is idempotent across two passes', () => {
    const once = roundTrip(cases.journal)
    expect(roundTrip(once)).toBe(once)
  })
})
