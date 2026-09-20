import fs from 'node:fs/promises'
import { resolveSafely } from './paths'

export type TreeNode =
  | { type: 'note'; name: string; path: string }
  | { type: 'folder'; name: string; path: string; children: TreeNode[] }

export async function readTree(root: string, relative = ''): Promise<TreeNode[]> {
  const dir = await resolveSafely(root, relative)
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const nodes: TreeNode[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const childPath = relative ? `${relative}/${entry.name}` : entry.name

    // Skip anything that escapes the root (a symlink pointing outside it)
    // rather than failing the whole walk.
    try {
      await resolveSafely(root, childPath)
    } catch {
      continue
    }

    if (entry.isDirectory()) {
      nodes.push({
        type: 'folder',
        name: entry.name,
        path: childPath,
        children: await readTree(root, childPath),
      })
    } else if (entry.name.endsWith('.md')) {
      nodes.push({ type: 'note', name: entry.name.slice(0, -3), path: childPath })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}
