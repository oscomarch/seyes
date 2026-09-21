import fs from 'node:fs/promises'
import { readTree, type TreeNode } from './tree'
import { resolveSafely } from './paths'

export type RecentNote = {
  path: string
  name: string
  folder: string
  modified: string
  excerpt: string
  words: number
}

export type Desk = {
  recent: RecentNote[]
  totals: { notes: number; words: number }
}

function flatten(nodes: TreeNode[]): Array<{ path: string; name: string }> {
  const out: Array<{ path: string; name: string }> = []
  for (const node of nodes) {
    if (node.type === 'folder') out.push(...flatten(node.children))
    else out.push({ path: node.path, name: node.name })
  }
  return out
}

/** First line of real prose, with markdown and HTML noise stripped out. */
function excerptOf(content: string): string {
  for (const raw of content.split('\n')) {
    const line = raw
      .replace(/<[^>]+>/g, '')
      .replace(/^[#>\-*\d.\s]*\[[ x]\]\s*/i, '')
      .replace(/^[#>\-*\s]+/, '')
      .replace(/[*_`~]/g, '')
      .trim()
    if (line) return line.slice(0, 120)
  }
  return ''
}

/**
 * The desk view: what you were last working on, and how much there is.
 *
 * This reads every note on every call rather than keeping an index. For a
 * personal folder that is instant, and it means the desk can never disagree
 * with what is actually on disk, including files you changed in Finder.
 */
export async function readDesk(root: string, limit = 6): Promise<Desk> {
  const notes = flatten(await readTree(root))
  const rows: RecentNote[] = []
  let words = 0

  for (const note of notes) {
    try {
      const target = await resolveSafely(root, note.path)
      const [stat, content] = await Promise.all([fs.stat(target), fs.readFile(target, 'utf8')])
      const count = content.trim() ? content.trim().split(/\s+/).length : 0
      words += count
      rows.push({
        path: note.path,
        name: note.name,
        folder: note.path.includes('/') ? note.path.slice(0, note.path.lastIndexOf('/')) : '',
        modified: stat.mtime.toISOString(),
        excerpt: excerptOf(content),
        words: count,
      })
    } catch {
      // Unreadable or vanished between listing and reading. Skip it rather
      // than failing the whole desk.
    }
  }

  rows.sort((a, b) => b.modified.localeCompare(a.modified))
  return { recent: rows.slice(0, limit), totals: { notes: rows.length, words } }
}
