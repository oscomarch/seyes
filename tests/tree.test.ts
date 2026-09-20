import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readTree } from '@/lib/fs/tree'

let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-tree-'))
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('readTree', () => {
  it('returns an empty list for an empty root', async () => {
    expect(await readTree(root)).toEqual([])
  })

  it('lists notes without their extension as the name', async () => {
    await fs.writeFile(path.join(root, 'Today.md'), '')
    const tree = await readTree(root)
    expect(tree).toEqual([{ type: 'note', name: 'Today', path: 'Today.md' }])
  })

  it('nests folders and sorts folders before notes', async () => {
    await fs.mkdir(path.join(root, 'Journal'))
    await fs.writeFile(path.join(root, 'Journal', 'Day one.md'), '')
    await fs.writeFile(path.join(root, 'Inbox.md'), '')
    const tree = await readTree(root)
    expect(tree).toEqual([
      {
        type: 'folder',
        name: 'Journal',
        path: 'Journal',
        children: [{ type: 'note', name: 'Day one', path: 'Journal/Day one.md' }],
      },
      { type: 'note', name: 'Inbox', path: 'Inbox.md' },
    ])
  })

  it('ignores dotfiles and non-markdown files', async () => {
    await fs.writeFile(path.join(root, '.DS_Store'), '')
    await fs.writeFile(path.join(root, 'photo.png'), '')
    await fs.writeFile(path.join(root, 'Real.md'), '')
    const tree = await readTree(root)
    expect(tree.map((n) => n.name)).toEqual(['Real'])
  })

  it('sorts case-insensitively', async () => {
    await fs.writeFile(path.join(root, 'banana.md'), '')
    await fs.writeFile(path.join(root, 'Apple.md'), '')
    const tree = await readTree(root)
    expect(tree.map((n) => n.name)).toEqual(['Apple', 'banana'])
  })

  it('skips a symlink that points outside the root instead of throwing', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-outside-'))
    try {
      await fs.writeFile(path.join(root, 'Kept.md'), '')
      await fs.symlink(outside, path.join(root, 'Escape'), 'dir')
      const tree = await readTree(root)
      expect(tree).toEqual([{ type: 'note', name: 'Kept', path: 'Kept.md' }])
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })
})
