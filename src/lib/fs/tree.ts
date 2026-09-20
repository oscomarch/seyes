import fs from 'node:fs/promises'
import { resolveSafely } from './paths'

export type TreeNode =
  | { type: 'note'; name: string; path: string; link?: true }
  | { type: 'folder'; name: string; path: string; children: TreeNode[]; link?: true }

export async function readTree(root: string, relative = ''): Promise<TreeNode[]> {
  const dir = await resolveSafely(root, relative)
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nodes: TreeNode[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const childPath = relative ? `${relative}/${entry.name}` : entry.name

    try {
      const childAbsolute = await resolveSafely(root, childPath)

      let isDirectory = entry.isDirectory()
      if (entry.isSymbolicLink()) {
        // A symlink's Dirent type reflects the LINK itself, not what it
        // points at, so `entry.isDirectory()` is always false for one.
        // `stat` (unlike `lstat`) follows the link, so a symlinked folder
        // appears as a folder and a symlinked note appears as a note —
        // the user placed it there on purpose (see resolveSafely). This
        // throws for a broken link or a symlink loop (ELOOP); either way
        // it's caught below and the entry is skipped, not fatal.
        isDirectory = (await fs.stat(childAbsolute)).isDirectory()
      }

      if (isDirectory) {
        nodes.push({
          type: 'folder',
          name: entry.name,
          path: childPath,
          children: await readTree(root, childPath),
          ...(entry.isSymbolicLink() ? { link: true } : {}),
        })
      } else if (entry.name.endsWith('.md')) {
        nodes.push({
          type: 'note',
          name: entry.name.slice(0, -3),
          path: childPath,
          ...(entry.isSymbolicLink() ? { link: true } : {}),
        })
      }
    } catch {
      // Broken symlink, symlink loop, permission error, or a lexical
      // escape (`../`, absolute path) — skip this one entry rather than
      // failing the whole sidebar.
      continue
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}
