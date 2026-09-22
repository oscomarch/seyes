import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export type Config = {
  root: string
  /** Folders used before, most recent first. Never includes `root`. */
  recent?: string[]
}

const MAX_RECENT = 5

export function defaultRoot(): string {
  return path.join(os.homedir(), 'Documents', 'Seyes')
}

/** App state lives here, never inside the user's writing folder. */
function configPath(): string {
  return path.join(os.homedir(), '.config', 'seyes', 'config.json')
}

/** The saved config as it is, without touching the disk beyond reading it. */
async function readConfig(): Promise<Config> {
  let config: Config = { root: defaultRoot() }
  try {
    const raw = await fs.readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<Config>
    if (typeof parsed.root === 'string' && parsed.root.length > 0) config = { root: parsed.root }
    if (Array.isArray(parsed.recent)) {
      config.recent = parsed.recent.filter((entry): entry is string => typeof entry === 'string')
    }
  } catch {
    // No config yet, or it is unreadable. Fall back to the default.
  }
  return config
}

/** The config, with the writing folder guaranteed to exist. */
export async function loadConfig(): Promise<Config> {
  const config = await readConfig()
  await fs.mkdir(config.root, { recursive: true })
  return config
}

export async function saveConfig(config: Config): Promise<void> {
  const target = configPath()
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, JSON.stringify(config, null, 2), 'utf8')
  await fs.mkdir(config.root, { recursive: true })
}

/**
 * Point Seyes at another folder, remembering the one it leaves. `forget` is
 * for a folder that no longer exists at its old path, because it was moved.
 */
export async function switchRoot(next: string, { forget = false } = {}): Promise<Config> {
  // readConfig, not loadConfig: after a move the current root is gone on
  // purpose, and loadConfig would recreate it as an empty ghost folder.
  const current = await readConfig()
  const root = path.resolve(next)
  const recent = [...(forget ? [] : [current.root]), ...(current.recent ?? [])]
    .filter((entry, index, all) => entry !== root && all.indexOf(entry) === index)
    .slice(0, MAX_RECENT)
  const config = { root, recent }
  await saveConfig(config)
  return config
}
