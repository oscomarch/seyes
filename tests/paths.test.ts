import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveInRoot, PathEscapeError } from '@/lib/fs/paths'

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

// Adversarial case flagged during self-review, not in the original spec:
// a symlink living inside the root but pointing outside it. resolveInRoot
// only reasons about the path string, not what the filesystem actually
// does when the path is opened. A symlink lets an attacker (or an
// accidental sync-tool artifact) plant a name that lexically resolves
// under the root while every real read/write against it lands outside.
describe('resolveInRoot with a symlink escape on real disk', () => {
  let realRoot: string
  let outside: string

  beforeAll(() => {
    realRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seyes-root-'))
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'seyes-outside-'))
    fs.writeFileSync(path.join(outside, 'passwd.md'), 'TOP SECRET')
    fs.symlinkSync(outside, path.join(realRoot, 'escape-link'))
  })

  afterAll(() => {
    fs.rmSync(realRoot, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('rejects a path that traverses a symlink out of the root', () => {
    expect(() => resolveInRoot(realRoot, 'escape-link/passwd.md')).toThrow(PathEscapeError)
  })
})
