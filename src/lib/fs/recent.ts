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

function countWords(content: string): number {
  return content.trim() ? content.trim().split(/\s+/).length : 0
}

/**
 * Word counts, keyed by file and modification time.
 *
 * The desk shows a total across every note, which naively means opening and
 * reading every file each time it is drawn. Since a file's word count cannot
 * change without its mtime changing, a count can be reused until then: the
 * first draw reads everything, and after that only the notes you actually
 * edited are read again. Bounded so a very large folder cannot grow it
 * without limit.
 */
const wordCache = new Map<string, { mtimeMs: number; words: number }>()
const CACHE_LIMIT = 5_000

function cachedWords(key: string, mtimeMs: number): number | null {
  const hit = wordCache.get(key)
  return hit && hit.mtimeMs === mtimeMs ? hit.words : null
}

function remember(key: string, mtimeMs: number, words: number) {
  if (wordCache.size >= CACHE_LIMIT) wordCache.clear()
  wordCache.set(key, { mtimeMs, words })
}

/**
 * The desk view: what you were last working on, and how much there is.
 *
 * Every note is stat-ed, which is cheap, but only the handful actually shown
 * are read in full for their excerpt. Counting words needs the text, so that
 * is what the cache above is for.
 *
 * There is still no index on disk. The folder remains the only source of
 * truth, so the desk can never disagree with what you would see in Finder.
 */
export async function readDesk(root: string, limit = 6): Promise<Desk> {
  const notes = flatten(await readTree(root))

  const stated = await Promise.all(
    notes.map(async (note) => {
      try {
        const target = await resolveSafely(root, note.path)
        const stat = await fs.stat(target)
        return { ...note, target, mtimeMs: stat.mtimeMs, modified: stat.mtime.toISOString() }
      } catch {
        // Unreadable, or gone between listing and stat. Skip it rather than
        // failing the whole desk.
        return null
      }
    }),
  )

  const live = stated.filter((n): n is NonNullable<typeof n> => n !== null)
  live.sort((a, b) => b.mtimeMs - a.mtimeMs)

  let words = 0
  const recent: RecentNote[] = []

  for (const [index, note] of live.entries()) {
    const shown = index < limit
    const known = cachedWords(note.path, note.mtimeMs)

    // Read only when the text is actually needed: for an excerpt on screen,
    // or because this file's word count is not already known.
    if (!shown && known !== null) {
      words += known
      continue
    }

    let content = ''
    try {
      content = await fs.readFile(note.target, 'utf8')
    } catch {
      continue
    }

    const count = known ?? countWords(content)
    remember(note.path, note.mtimeMs, count)
    words += count

    if (shown) {
      recent.push({
        path: note.path,
        name: note.name,
        folder: note.path.includes('/') ? note.path.slice(0, note.path.lastIndexOf('/')) : '',
        modified: note.modified,
        excerpt: excerptOf(content),
        words: count,
      })
    }
  }

  return { recent, totals: { notes: live.length, words } }
}
