import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Editor } from '@tiptap/core'
import { seyesExtensions } from '@/lib/editor/extensions'
import { createNote, writeNote, readNote } from '@/lib/fs/notes'

let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-persist-'))
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('write then reopen', () => {
  it('survives a full create, edit, save, reopen cycle unchanged', async () => {
    const relative = await createNote(root, '', 'Untitled')

    // The user types.
    const typing = new Editor({ extensions: seyesExtensions, content: '' })
    typing.commands.setContent(
      typing.storage.markdown.parser.parse(
        '# Monday\n\nFelt <mark>good</mark>. Wrote *a lot*.\n\n- [x] pages\n- [ ] run',
      ),
    )
    const saved = typing.storage.markdown.getMarkdown()
    await writeNote(root, relative, saved)
    typing.destroy()

    // The app is closed and reopened.
    const reopened = new Editor({ extensions: seyesExtensions, content: '' })
    const fromDisk = await readNote(root, relative)
    reopened.commands.setContent(reopened.storage.markdown.parser.parse(fromDisk))
    const after = reopened.storage.markdown.getMarkdown()
    reopened.destroy()

    expect(after.trim()).toBe(saved.trim())
  })

  it('does not drift after ten save cycles', async () => {
    const relative = await createNote(root, '', 'Drift')
    const editor = new Editor({ extensions: seyesExtensions, content: '' })
    let content =
      '# Title\n\n- [ ] one\n- [x] two\n\n<details>\n<summary>More</summary>\n\nHidden\n\n</details>'

    for (let i = 0; i < 10; i++) {
      editor.commands.setContent(editor.storage.markdown.parser.parse(content))
      content = editor.storage.markdown.getMarkdown()
      await writeNote(root, relative, content)
      content = await readNote(root, relative)
    }
    editor.destroy()

    const expected = [
      '# Title',
      '',
      '- [ ] one',
      '- [x] two',
      '',
      '<details>',
      '<summary>More</summary>',
      '',
      'Hidden',
      '',
      '</details>',
    ].join('\n')

    expect(content.trim()).toBe(expected)
  })
})
