import fs from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { resolveSafely } from './paths'

export async function readNote(root: string, relative: string): Promise<string> {
  const target = await resolveSafely(root, relative)
  return fs.readFile(target, 'utf8')
}

/**
 * Atomic write: the content lands in a temp file in the same directory and is
 * then renamed over the target. rename() is atomic on the same filesystem, so
 * an interrupted save can never leave a half-written note.
 */
export async function writeNote(root: string, relative: string, content: string): Promise<void> {
  const target = await resolveSafely(root, relative)
  const dir = path.dirname(target)
  await fs.mkdir(dir, { recursive: true })

  const normalized = content === '' ? '' : `${content.replace(/\n+$/, '')}\n`

  const temp = path.join(dir, `.${path.basename(target)}.${randomBytes(6).toString('hex')}.tmp`)
  try {
    await fs.writeFile(temp, normalized, 'utf8')
    await fs.rename(temp, target)
  } catch (error) {
    await fs.rm(temp, { force: true })
    throw error
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

/** Returns the relative path of the created note, suffixing on collision. */
export async function createNote(root: string, folder: string, baseName: string): Promise<string> {
  for (let n = 1; n < 1000; n++) {
    const name = n === 1 ? `${baseName}.md` : `${baseName} ${n}.md`
    const relative = folder ? `${folder}/${name}` : name
    if (!(await exists(await resolveSafely(root, relative)))) {
      await writeNote(root, relative, '')
      return relative
    }
  }
  throw new Error('Could not find a free filename')
}

export async function createFolder(root: string, parent: string, name: string): Promise<string> {
  const relative = parent ? `${parent}/${name}` : name
  await fs.mkdir(await resolveSafely(root, relative), { recursive: true })
  return relative
}

export async function movePath(root: string, from: string, to: string): Promise<void> {
  const source = await resolveSafely(root, from)
  const target = await resolveSafely(root, to)
  if (source === target) return
  if (await exists(target)) throw new Error(`A file named "${path.basename(to)}" already exists`)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.rename(source, target)
}

/**
 * Send to the OS trash rather than unlinking. A journal entry deleted by a
 * misclick must be recoverable from the Trash.
 */
export async function trashPath(root: string, relative: string): Promise<void> {
  const target = await resolveSafely(root, relative)
  const { default: trash } = await import('trash')
  await trash(target)
}
