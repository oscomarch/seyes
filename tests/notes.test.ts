import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readNote, writeNote, createNote, createFolder, movePath, trashPath } from '@/lib/fs/notes'

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
    expect(await readNote(root, 'a.md')).toBe('# Hello\n')
  })

  it('creates parent folders on write', async () => {
    await writeNote(root, 'Journal/2026/today.md', 'x')
    expect(await readNote(root, 'Journal/2026/today.md')).toBe('x\n')
  })

  it('leaves no temp files behind after a write', async () => {
    await writeNote(root, 'a.md', 'x')
    const entries = await fs.readdir(root)
    expect(entries).toEqual(['a.md'])
  })

  it('overwrites existing content completely', async () => {
    await writeNote(root, 'a.md', 'a much longer original body')
    await writeNote(root, 'a.md', 'short')
    expect(await readNote(root, 'a.md')).toBe('short\n')
  })

  it('content without a trailing newline gains exactly one', async () => {
    await writeNote(root, 'a.md', '# Monday')
    const raw = await fs.readFile(path.join(root, 'a.md'), 'utf8')
    expect(raw).toBe('# Monday\n')
  })

  it('content with one trailing newline keeps exactly one', async () => {
    await writeNote(root, 'a.md', '# Monday\n')
    const raw = await fs.readFile(path.join(root, 'a.md'), 'utf8')
    expect(raw).toBe('# Monday\n')
  })

  it('content with several trailing newlines is reduced to exactly one', async () => {
    await writeNote(root, 'a.md', '# Monday\n\n\n')
    const raw = await fs.readFile(path.join(root, 'a.md'), 'utf8')
    expect(raw).toBe('# Monday\n')
  })

  it('empty content produces a genuinely empty file', async () => {
    await writeNote(root, 'a.md', '')
    const stat = await fs.stat(path.join(root, 'a.md'))
    expect(stat.size).toBe(0)
  })

  it('reading back content written with a trailing newline round-trips as expected', async () => {
    await writeNote(root, 'a.md', '# Monday\n')
    expect(await readNote(root, 'a.md')).toBe('# Monday\n')
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

describe('move and trash', () => {
  it('renames a note in place', async () => {
    await writeNote(root, 'a.md', 'body')
    await movePath(root, 'a.md', 'b.md')
    expect(await readNote(root, 'b.md')).toBe('body\n')
    await expect(readNote(root, 'a.md')).rejects.toThrow()
  })

  it('moves a note into a folder, creating it', async () => {
    await writeNote(root, 'a.md', 'body')
    await movePath(root, 'a.md', 'Journal/a.md')
    expect(await readNote(root, 'Journal/a.md')).toBe('body\n')
  })

  it('refuses to overwrite an existing file', async () => {
    await writeNote(root, 'a.md', 'a')
    await writeNote(root, 'b.md', 'b')
    await expect(movePath(root, 'a.md', 'b.md')).rejects.toThrow(/already exists/)
    expect(await readNote(root, 'b.md')).toBe('b\n')
  })

  it('refuses to move outside the root', async () => {
    await writeNote(root, 'a.md', 'a')
    await expect(movePath(root, 'a.md', '../a.md')).rejects.toThrow()
  })

  it('trashPath removes the file from the writing folder', async () => {
    await writeNote(root, 'a.md', 'body')
    await trashPath(root, 'a.md')
    await expect(readNote(root, 'a.md')).rejects.toThrow()
  })
})
