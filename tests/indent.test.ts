import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { seyesExtensions } from '@/lib/editor/extensions'

let editor: Editor

beforeEach(() => {
  editor = new Editor({ extensions: seyesExtensions, content: '' })
})
afterEach(() => editor.destroy())

function load(markdown: string) {
  editor.commands.setContent(editor.storage.markdown.parser.parse(markdown))
}

function markdown() {
  return editor.storage.markdown.getMarkdown().trim()
}

/** Put the caret at the end of the first text node containing `text`. */
function caretIn(text: string) {
  let at = -1
  editor.state.doc.descendants((node, pos) => {
    if (at === -1 && node.isText && node.text?.includes(text)) at = pos + node.text.indexOf(text) + text.length
  })
  if (at === -1) throw new Error(`no text "${text}"`)
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, at)))
}

/** Select from the start of `from` to the end of `to`. */
function select(from: string, to: string) {
  let start = -1
  let end = -1
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return
    if (start === -1 && node.text?.includes(from)) start = pos + node.text.indexOf(from)
    if (node.text?.includes(to)) end = pos + node.text.indexOf(to) + to.length
  })
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, start, end)))
}

// `Mod` is Cmd on a Mac and Ctrl everywhere else, including this test DOM.
const MOD = /Mac/.test(navigator.platform) ? { meta: true } : { ctrl: true }

/** Returns whether the editor claimed the key, i.e. the browser would NOT get it. */
function press(key: string, modifiers: { shift?: boolean; meta?: boolean; ctrl?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey: !!modifiers.shift,
    metaKey: !!modifiers.meta,
    ctrlKey: !!modifiers.ctrl,
    bubbles: true,
    cancelable: true,
  })
  return editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event)) ?? false
}

describe('Tab in lists', () => {
  it('indents a bullet under the one above it', () => {
    load('- one\n- two')
    caretIn('two')
    expect(press('Tab')).toBe(true)
    expect(markdown()).toBe('- one\n  - two')
  })

  it('outdents a nested bullet with Shift+Tab', () => {
    load('- one\n  - two')
    caretIn('two')
    expect(press('Tab', { shift: true })).toBe(true)
    expect(markdown()).toBe('- one\n- two')
  })

  it('keeps the key on the first bullet, where there is nothing to indent under', () => {
    load('- one\n- two')
    caretIn('one')
    // Claimed, so focus stays on the page instead of jumping to the next control.
    expect(press('Tab')).toBe(true)
    expect(markdown()).toBe('- one\n- two')
  })

  it('keeps the key on a plain line and leaves the text alone', () => {
    load('just a line')
    caretIn('line')
    expect(press('Tab')).toBe(true)
    // A tab at the start of a markdown line would turn it into a code block.
    expect(markdown()).toBe('just a line')
  })

  it('does not turn a top-level bullet into a paragraph on Shift+Tab', () => {
    load('- one\n- two')
    caretIn('two')
    expect(press('Tab', { shift: true })).toBe(true)
    expect(markdown()).toBe('- one\n- two')
  })

  it('indents several selected bullets at once', () => {
    load('- one\n- two\n- three')
    select('two', 'three')
    press('Tab')
    expect(markdown()).toBe('- one\n  - two\n  - three')
  })

  it('works on to-dos', () => {
    load('- [ ] one\n- [ ] two')
    caretIn('two')
    expect(press('Tab')).toBe(true)
    expect(markdown()).toBe('- [ ] one\n  - [ ] two')
  })

  it('works on numbered lists', () => {
    load('1. one\n2. two')
    caretIn('two')
    press('Tab')
    expect(markdown()).toMatch(/^1\. one\n\s+1\. two$/)
  })

  it('also indents with Cmd+] and outdents with Cmd+[', () => {
    load('- one\n- two')
    caretIn('two')
    expect(press(']', MOD)).toBe(true)
    expect(markdown()).toBe('- one\n  - two')
    expect(press('[', MOD)).toBe(true)
    expect(markdown()).toBe('- one\n- two')
  })
})
