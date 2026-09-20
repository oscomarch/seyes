import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export type Config = { root: string }

export function defaultRoot(): string {
  return path.join(os.homedir(), 'Documents', 'Seyes')
}

/** App state lives here, never inside the user's writing folder. */
function configPath(): string {
  return path.join(os.homedir(), '.config', 'seyes', 'config.json')
}

export async function loadConfig(): Promise<Config> {
  let config: Config = { root: defaultRoot() }
  try {
    const raw = await fs.readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<Config>
    if (typeof parsed.root === 'string' && parsed.root.length > 0) config = { root: parsed.root }
  } catch {
    // No config yet, or it is unreadable. Fall back to the default.
  }
  await fs.mkdir(config.root, { recursive: true })
  return config
}

export async function saveConfig(config: Config): Promise<void> {
  const target = configPath()
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, JSON.stringify(config, null, 2), 'utf8')
  await fs.mkdir(config.root, { recursive: true })
}
