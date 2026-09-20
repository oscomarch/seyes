import fs from 'node:fs/promises'
import { readTree, type TreeNode } from './tree'
import { resolveSafely } from './paths'

export type SearchHit = { path: string; name: string; excerpt: string }

function flatten(nodes: TreeNode[]): Array<{ path: string; name: string }> {
  const out: Array<{ path: string; name: string }> = []
  for (const node of nodes) {
    if (node.type === 'folder') out.push(...flatten(node.children))
    else out.push({ path: node.path, name: node.name })
  }
  return out
}

/**
 * Linear scan. With a personal journal this stays instant well past ten
 * thousand notes, and it means there is no index to build, corrupt or
 * invalidate when files change under the app in Finder.
 */
export async function searchNotes(root: string, query: string): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const notes = flatten(await readTree(root))
  const hits: SearchHit[] = []

  for (const note of notes) {
    let content: string
    try {
      content = await fs.readFile(await resolveSafely(root, note.path), 'utf8')
    } catch {
      continue // unreadable or escaping: skip rather than abort the search
    }
    const index = content.toLowerCase().indexOf(needle)
    const nameMatch = note.name.toLowerCase().includes(needle)
    if (index === -1 && !nameMatch) continue

    const excerpt =
      index === -1
        ? content.slice(0, 80).replace(/\s+/g, ' ').trim()
        : content
            .slice(Math.max(0, index - 30), index + needle.length + 50)
            .replace(/\s+/g, ' ')
            .trim()

    hits.push({ path: note.path, name: note.name, excerpt })
  }

  return hits
}
