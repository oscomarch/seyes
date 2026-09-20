import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { searchNotes } from '@/lib/fs/search'

let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-search-'))
  await fs.mkdir(path.join(root, 'Journal'))
  await fs.writeFile(path.join(root, 'Journal', 'Monday.md'), 'Woke up early and ran')
  await fs.writeFile(path.join(root, 'Startups.md'), 'Pricing thoughts for the marketplace')
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('searchNotes', () => {
  it('matches note content case-insensitively', async () => {
    const results = await searchNotes(root, 'PRICING')
    expect(results.map((r) => r.path)).toEqual(['Startups.md'])
  })

  it('matches on the filename too', async () => {
    const results = await searchNotes(root, 'monday')
    expect(results.map((r) => r.path)).toEqual(['Journal/Monday.md'])
  })

  it('returns a surrounding excerpt for a content match', async () => {
    const [hit] = await searchNotes(root, 'early')
    expect(hit.excerpt).toContain('early')
  })

  it('returns nothing for an empty query', async () => {
    expect(await searchNotes(root, '   ')).toEqual([])
  })

  it('returns nothing when there is no match', async () => {
    expect(await searchNotes(root, 'zzzz')).toEqual([])
  })

  // Inverted: searchNotes walks readTree's output, and readTree now
  // follows a symlinked directory instead of hiding it (see tests/tree.test.ts
  // and src/lib/fs/paths.ts's resolveSafely) since the user placed the
  // symlink there deliberately. The note behind it is therefore searchable
  // like any other note.
  it('includes notes reached through a symlinked directory pointing outside the root', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-search-outside-'))
    try {
      await fs.writeFile(path.join(outside, 'Secret.md'), 'pricing secret plan')
      await fs.symlink(outside, path.join(root, 'Escape'), 'dir')
      const results = await searchNotes(root, 'pricing')
      expect(results.map((r) => r.path).sort()).toEqual(['Escape/Secret.md', 'Startups.md'])
    } finally {
      await fs.rm(outside, { recursive: true, force: true })
    }
  })
})
