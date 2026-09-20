import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig, saveConfig, defaultRoot } from '@/lib/config'

let home: string

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'seyes-home-'))
  vi.spyOn(os, 'homedir').mockReturnValue(home)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(home, { recursive: true, force: true })
})

describe('config', () => {
  it('defaults the root to ~/Documents/Seyes', () => {
    expect(defaultRoot()).toBe(path.join(home, 'Documents', 'Seyes'))
  })

  it('creates the root folder on first load', async () => {
    const config = await loadConfig()
    const stat = await fs.stat(config.root)
    expect(stat.isDirectory()).toBe(true)
  })

  it('round-trips a saved root', async () => {
    const custom = path.join(home, 'Writing')
    await saveConfig({ root: custom })
    expect((await loadConfig()).root).toBe(custom)
  })

  it('stores config outside the writing folder', async () => {
    const config = await loadConfig()
    expect(await fs.readdir(config.root)).toEqual([])
  })
})
