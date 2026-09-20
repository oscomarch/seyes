import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { resolveInRoot, resolveSafely, PathEscapeError } from '@/lib/fs/paths'

const ROOT = '/tmp/seyes-root'

describe('resolveInRoot', () => {
  it('resolves a simple relative path', () => {
    expect(resolveInRoot(ROOT, 'Journal/today.md')).toBe('/tmp/seyes-root/Journal/today.md')
  })

  it('resolves the root itself', () => {
    expect(resolveInRoot(ROOT, '')).toBe('/tmp/seyes-root')
  })

  it('normalises redundant segments', () => {
    expect(resolveInRoot(ROOT, './Journal/../Notes/a.md')).toBe('/tmp/seyes-root/Notes/a.md')
  })

  it('rejects parent traversal', () => {
    expect(() => resolveInRoot(ROOT, '../secrets.md')).toThrow(PathEscapeError)
  })

  it('rejects deep parent traversal', () => {
    expect(() => resolveInRoot(ROOT, 'a/b/../../../../etc/passwd')).toThrow(PathEscapeError)
  })

  it('rejects absolute paths', () => {
    expect(() => resolveInRoot(ROOT, '/etc/passwd')).toThrow(PathEscapeError)
  })

  it('rejects a sibling directory with the root as a string prefix', () => {
    expect(() => resolveInRoot(ROOT, '../seyes-root-evil/a.md')).toThrow(PathEscapeError)
  })

  it('rejects null bytes', () => {
    expect(() => resolveInRoot(ROOT, 'a\0b.md')).toThrow(PathEscapeError)
  })
})

// resolveSafely: containment verified against the REAL filesystem, so a
// symlink inside the root cannot be used to escape it. resolveInRoot alone
// is purely lexical (see the gap this covers), so every one of these
// creates real files/symlinks in an isolated temp dir with proper teardown.
describe('resolveSafely', () => {
  let root: string
  let outside: string

  beforeEach(() => {
    root = fs.mkdtempSync('/tmp/seyes-safe-root-')
    outside = fs.mkdtempSync('/tmp/seyes-safe-outside-')
  })

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('rejects a symlinked file inside the root pointing to a file outside', async () => {
    fs.writeFileSync(path.join(outside, 'secret.md'), 'TOP SECRET')
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'link.md'))

    await expect(resolveSafely(root, 'link.md')).rejects.toThrow(PathEscapeError)
  })

  it('rejects a write path inside a symlinked directory pointing outside the root', async () => {
    fs.mkdirSync(path.join(outside, 'dir'))
    fs.symlinkSync(path.join(outside, 'dir'), path.join(root, 'linked-dir'))

    await expect(resolveSafely(root, 'linked-dir/note.md')).rejects.toThrow(PathEscapeError)
  })

  it('rejects a broken symlink inside the root pointing outside', async () => {
    fs.symlinkSync(path.join(outside, 'does-not-exist.md'), path.join(root, 'broken-link.md'))

    await expect(resolveSafely(root, 'broken-link.md')).rejects.toThrow(PathEscapeError)
  })

  it('allows a symlink inside the root that points to another location inside the root', async () => {
    fs.mkdirSync(path.join(root, 'Notes'))
    fs.writeFileSync(path.join(root, 'Notes', 'a.md'), 'hello')
    fs.symlinkSync(path.join(root, 'Notes'), path.join(root, 'link-to-notes'))

    await expect(resolveSafely(root, 'link-to-notes/a.md')).resolves.toBe(
      path.join(root, 'link-to-notes/a.md')
    )
  })

  it('allows an ordinary nested path that exists, returning the lexical path', async () => {
    fs.mkdirSync(path.join(root, 'Journal'))
    fs.writeFileSync(path.join(root, 'Journal', 'today.md'), 'hello')

    await expect(resolveSafely(root, 'Journal/today.md')).resolves.toBe(
      path.join(root, 'Journal/today.md')
    )
  })

  it('allows a path that does not exist yet inside an ordinary directory', async () => {
    fs.mkdirSync(path.join(root, 'Journal'))

    await expect(resolveSafely(root, 'Journal/new-note.md')).resolves.toBe(
      path.join(root, 'Journal/new-note.md')
    )
  })

  it('allows the root itself with no false rejection when the root sits under a symlinked path', async () => {
    // On macOS /tmp is itself a symlink to /private/tmp, so root here is
    // reached through a symlink before any user-supplied path is involved.
    await expect(resolveSafely(root, '')).resolves.toBe(root)
    await expect(resolveSafely(root, 'anything.md')).resolves.toBe(path.join(root, 'anything.md'))
  })
})
