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
    // An ordinary note is not a symlink, so it must not carry the `link`
    // marker at all (not even `link: false`) — toEqual above already
    // guarantees this, but assert it explicitly since it's the point.
    expect(tree[0]).not.toHaveProperty('link')
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

  // Inverted: a symlinked directory used to vanish entirely from the tree
  // (resolveSafely rejected it, and even before that entry.isDirectory()
  // is false for a symlink so it matched neither branch). It is now
  // followed and appears as a folder, with its real children listed —
  // the user placed the symlink there on purpose.
  it('lists a symlinked directory pointing outside the root as a folder, with its children', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-outside-'))
    try {
      await fs.writeFile(path.join(outside, 'Note.md'), '')
      await fs.writeFile(path.join(root, 'Kept.md'), '')
      await fs.symlink(outside, path.join(root, 'Escape'), 'dir')

      const tree = await readTree(root)

      expect(tree).toEqual([
        {
          type: 'folder',
          name: 'Escape',
          path: 'Escape',
          link: true,
          children: [{ type: 'note', name: 'Note', path: 'Escape/Note.md' }],
        },
        { type: 'note', name: 'Kept', path: 'Kept.md' },
      ])
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })

  it('lists a symlinked markdown file as a note', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-outside-'))
    try {
      await fs.writeFile(path.join(outside, 'Real.md'), 'hello')
      await fs.symlink(path.join(outside, 'Real.md'), path.join(root, 'Linked.md'), 'file')

      const tree = await readTree(root)

      expect(tree).toEqual([{ type: 'note', name: 'Linked', path: 'Linked.md', link: true }])
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })

  it('skips a broken symlink without throwing, keeping other entries', async () => {
    await fs.writeFile(path.join(root, 'Kept.md'), '')
    await fs.symlink(path.join(root, 'does-not-exist.md'), path.join(root, 'Broken.md'), 'file')

    const tree = await readTree(root)

    expect(tree).toEqual([{ type: 'note', name: 'Kept', path: 'Kept.md' }])
  })

  it(
    'does not hang on a symlink loop',
    async () => {
      await fs.symlink(path.join(root, 'b'), path.join(root, 'a'), 'dir')
      await fs.symlink(path.join(root, 'a'), path.join(root, 'b'), 'dir')
      await fs.writeFile(path.join(root, 'Kept.md'), '')

      const tree = await readTree(root)

      expect(tree).toEqual([{ type: 'note', name: 'Kept', path: 'Kept.md' }])
    },
    2000
  )

  it('flags a symlinked directory with link: true', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-outside-'))
    try {
      await fs.symlink(outside, path.join(root, 'Elsewhere'), 'dir')

      const tree = await readTree(root)

      expect(tree).toEqual([{ type: 'folder', name: 'Elsewhere', path: 'Elsewhere', link: true, children: [] }])
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })

  it('flags a symlinked markdown file with link: true', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-outside-'))
    try {
      await fs.writeFile(path.join(outside, 'Original.md'), 'hello')
      await fs.symlink(path.join(outside, 'Original.md'), path.join(root, 'Pointer.md'), 'file')

      const tree = await readTree(root)

      expect(tree).toEqual([{ type: 'note', name: 'Pointer', path: 'Pointer.md', link: true }])
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })
})
