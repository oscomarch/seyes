import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { moveFolder, isInICloud, displayPath } from '@/lib/fs/folder'
import { loadConfig, switchRoot } from '@/lib/config'

let home: string

beforeEach(async () => {
  home = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-folder-')))
  vi.spyOn(os, 'homedir').mockReturnValue(home)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(home, { recursive: true, force: true })
})

async function vault(name = 'Seyes') {
  const root = path.join(home, name)
  await fs.mkdir(path.join(root, 'Journal'), { recursive: true })
  await fs.writeFile(path.join(root, 'Journal', 'Monday.md'), 'morning pages\n')
  await fs.writeFile(path.join(root, 'Ideas.md'), 'one\n')
  return root
}

describe('moving the writing folder', () => {
  it('moves the whole folder, keeping its name and every note', async () => {
    const root = await vault()
    const dest = path.join(home, 'Archive')
    await fs.mkdir(dest)
    const moved = await moveFolder(root, dest)
    expect(moved).toBe(path.join(dest, 'Seyes'))
    expect(await fs.readFile(path.join(moved, 'Journal', 'Monday.md'), 'utf8')).toBe('morning pages\n')
    await expect(fs.stat(root)).rejects.toThrow()
  })

  it('refuses to move the folder into itself', async () => {
    const root = await vault()
    await expect(moveFolder(root, path.join(root, 'Journal'))).rejects.toThrow(/into itself/)
    expect(await fs.readFile(path.join(root, 'Ideas.md'), 'utf8')).toBe('one\n')
  })

  it('refuses when something with that name is already there, and touches nothing', async () => {
    const root = await vault()
    const dest = path.join(home, 'Archive')
    await fs.mkdir(path.join(dest, 'Seyes'), { recursive: true })
    await fs.writeFile(path.join(dest, 'Seyes', 'Other.md'), 'keep me\n')
    await expect(moveFolder(root, dest)).rejects.toThrow(/already something named "Seyes"/)
    expect(await fs.readFile(path.join(root, 'Ideas.md'), 'utf8')).toBe('one\n')
    expect(await fs.readdir(path.join(dest, 'Seyes'))).toEqual(['Other.md'])
  })

  it('is a no-op when the destination is where it already is', async () => {
    const root = await vault()
    expect(await moveFolder(root, home)).toBe(root)
  })
})

describe('following a moved folder', () => {
  it('leaves nothing behind at the old path', async () => {
    const root = await vault()
    await switchRoot(root)
    const dest = path.join(home, 'Archive')
    await fs.mkdir(dest)
    const moved = await moveFolder(root, dest)
    await switchRoot(moved, { forget: true })
    // Switching must not recreate the folder it just moved away from.
    await expect(fs.stat(root)).rejects.toThrow()
    expect((await loadConfig()).root).toBe(moved)
  })
})

describe('recent folders', () => {
  it('remembers the folder you switch away from', async () => {
    const a = await vault('A')
    const b = await vault('B')
    await switchRoot(a)
    await switchRoot(b)
    const config = await loadConfig()
    expect(config.root).toBe(b)
    expect(config.recent?.[0]).toBe(a)
    expect(config.recent).not.toContain(b)
  })

  it('does not remember a folder that was moved away', async () => {
    const a = await vault('A')
    await switchRoot(a)
    await switchRoot(path.join(home, 'Moved', 'A'), { forget: true })
    expect((await loadConfig()).recent ?? []).not.toContain(a)
  })
})

describe('iCloud detection', () => {
  it('treats ~/Documents as synced only when Desktop & Documents sync is on', async () => {
    const docs = path.join(home, 'Documents', 'Seyes')
    expect(isInICloud(docs)).toBe(false)
    await fs.mkdir(path.join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Documents'), {
      recursive: true,
    })
    expect(isInICloud(docs)).toBe(true)
    expect(isInICloud(path.join(home, 'Seyes'))).toBe(false)
  })

  it('shows paths under home with a tilde', () => {
    expect(displayPath(path.join(home, 'Seyes'))).toBe('~/Seyes')
    expect(displayPath('/Volumes/SSD/Seyes')).toBe('/Volumes/SSD/Seyes')
  })
})
