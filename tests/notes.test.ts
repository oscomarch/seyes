import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readNote, writeNote, createNote, createFolder } from '@/lib/fs/notes'

let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-test-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('notes', () => {
  it('writes then reads a note', async () => {
    await writeNote(root, 'a.md', '# Hello')
    expect(await readNote(root, 'a.md')).toBe('# Hello')
  })

  it('creates parent folders on write', async () => {
    await writeNote(root, 'Journal/2026/today.md', 'x')
    expect(await readNote(root, 'Journal/2026/today.md')).toBe('x')
  })

  it('leaves no temp files behind after a write', async () => {
    await writeNote(root, 'a.md', 'x')
    const entries = await fs.readdir(root)
    expect(entries).toEqual(['a.md'])
  })

  it('overwrites existing content completely', async () => {
    await writeNote(root, 'a.md', 'a much longer original body')
    await writeNote(root, 'a.md', 'short')
    expect(await readNote(root, 'a.md')).toBe('short')
  })

  it('createNote returns a non-colliding name', async () => {
    const first = await createNote(root, '', 'Untitled')
    const second = await createNote(root, '', 'Untitled')
    expect(first).toBe('Untitled.md')
    expect(second).toBe('Untitled 2.md')
  })

  it('createFolder makes a real directory', async () => {
    await createFolder(root, '', 'Startups')
    const stat = await fs.stat(path.join(root, 'Startups'))
    expect(stat.isDirectory()).toBe(true)
  })

  it('refuses to read outside the root', async () => {
    await expect(readNote(root, '../escape.md')).rejects.toThrow()
  })
})
