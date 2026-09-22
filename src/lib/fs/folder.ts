import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** `/Users/oscar/Seyes` as `~/Seyes`, the way people say it. */
export function displayPath(absolute: string): string {
  const home = os.homedir()
  if (absolute === home) return '~'
  return absolute.startsWith(home + path.sep) ? `~${absolute.slice(home.length)}` : absolute
}

function inside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent + path.sep)
}

/**
 * Whether a folder is synced by iCloud Drive. Anything under iCloud Drive
 * itself is, and so are ~/Desktop and ~/Documents when "Desktop & Documents
 * Folders" is switched on, which macOS signals by mirroring them into iCloud
 * Drive. People pick ~/Documents expecting it to stay on the machine, so this
 * is worth saying out loud.
 */
export function isInICloud(absolute: string): boolean {
  const home = os.homedir()
  const drive = path.join(/*turbopackIgnore: true*/ home, 'Library', 'Mobile Documents')
  if (inside(absolute, drive)) return true
  for (const synced of ['Desktop', 'Documents']) {
    const local = path.join(/*turbopackIgnore: true*/ home, synced)
    const mirror = path.join(/*turbopackIgnore: true*/ drive, 'com~apple~CloudDocs', synced)
    if (inside(absolute, local) && existsSync(mirror)) return true
  }
  return false
}

export function describeFolder(absolute: string) {
  return {
    path: absolute,
    display: displayPath(absolute),
    name: path.basename(absolute) || absolute,
    icloud: isInICloud(absolute),
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.lstat(target)
    return true
  } catch {
    return false
  }
}

async function listFiles(dir: string, base = dir): Promise<string[]> {
  const out: string[] = []
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listFiles(full, base)))
    else out.push(path.relative(base, full))
  }
  return out.sort()
}

/**
 * Move the whole writing folder into `destination`, keeping its name, the
 * way Obsidian's "Move vault" does. Moving the folder as one unit, rather
 * than merging its contents into whatever is already there, means there is
 * never a half-merged state and never a name collision between two notes.
 *
 * Every check happens before anything is touched. Within one disk this is a
 * single rename. Across disks (to an external drive) it is a copy, a check
 * that every file arrived, and only then the original goes to the Trash.
 */
export async function moveFolder(root: string, destination: string): Promise<string> {
  const from = path.resolve(root)
  const into = path.resolve(destination)
  const to = path.join(into, path.basename(from))

  if (to === from) return from
  if (inside(into, from)) throw new Error("You can't move the folder into itself.")
  if (!(await exists(into))) throw new Error(`${displayPath(into)} doesn't exist.`)
  if (await exists(to)) {
    throw new Error(`There's already something named "${path.basename(from)}" in ${displayPath(into)}.`)
  }

  try {
    await fs.rename(from, to)
    return to
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
  }

  // A different disk. Copy, verify, and only then let go of the original.
  try {
    await fs.cp(from, to, { recursive: true, preserveTimestamps: true, errorOnExist: true, force: false })
    const [before, after] = await Promise.all([listFiles(from), listFiles(to)])
    if (before.join('\n') !== after.join('\n')) throw new Error('Not every file arrived. Nothing was moved.')
  } catch (error) {
    await fs.rm(to, { recursive: true, force: true })
    throw error
  }
  // The copy is verified, but the original still goes to the Trash rather
  // than being deleted: a writing folder is worth one more undo.
  const { default: trash } = await import('trash')
  await trash(from)
  return to
}
