import path from 'node:path'
import fs from 'node:fs/promises'

export class PathEscapeError extends Error {
  constructor(attempted: string) {
    super(`Path escapes the root folder: ${attempted}`)
    this.name = 'PathEscapeError'
  }
}

/**
 * Resolve a user-supplied relative path against the root folder.
 * Throws PathEscapeError if the result would land outside the root.
 */
export function resolveInRoot(root: string, relative: string): string {
  if (relative.includes('\0')) throw new PathEscapeError(relative)
  if (path.isAbsolute(relative)) throw new PathEscapeError(relative)

  const absoluteRoot = path.resolve(root)
  const target = path.resolve(absoluteRoot, relative)

  if (target === absoluteRoot) return target
  // The separator suffix prevents `/root-evil` matching the root `/root`.
  if (!target.startsWith(absoluteRoot + path.sep)) throw new PathEscapeError(relative)

  return target
}

/**
 * Follow the symlink chain (if any) starting at `target`, purely to detect
 * a LOOP. Uses `lstat`/`readlink` rather than `fs.realpath` so a trailing
 * segment that does not exist yet (or a broken symlink) is tolerated
 * instead of throwing — new-note creation must still work, and a symlink
 * that merely points somewhere that doesn't exist is not a loop. `seen`
 * tracks symlinks on the CURRENT resolution stack (not every symlink ever
 * visited), so the same real symlink legitimately encountered twice in
 * unrelated branches of one resolution is not mistaken for a cycle.
 * Throws PathEscapeError only when a genuine cycle is found.
 */
async function resolveRealish(target: string, seen: Set<string> = new Set()): Promise<string> {
  const { dir, base, root: fsRoot } = path.parse(target)
  if (!base) return fsRoot

  const parentReal = await resolveRealish(dir, seen)
  const candidate = path.join(parentReal, base)

  let stat
  try {
    stat = await fs.lstat(candidate)
  } catch {
    // Does not exist (yet). Nothing further to resolve.
    return candidate
  }

  if (!stat.isSymbolicLink()) return candidate

  if (seen.has(candidate)) throw new PathEscapeError(target)
  seen.add(candidate)

  try {
    const linkTarget = await fs.readlink(candidate)
    const absoluteLinkTarget = path.isAbsolute(linkTarget)
      ? linkTarget
      : path.resolve(path.dirname(candidate), linkTarget)

    return await resolveRealish(absoluteLinkTarget, seen)
  } finally {
    seen.delete(candidate)
  }
}

/**
 * Resolve a user-supplied relative path against the root folder.
 *
 * Lexical containment (`resolveInRoot`) is always enforced first: `../`,
 * absolute paths and null bytes arriving from the API are rejected,
 * because those are an attempt to escape a boundary the caller does not
 * control.
 *
 * A symlink physically placed inside the root — even one whose target
 * lies outside the root — is deliberately FOLLOWED, not rejected. Putting
 * a symlink in your own writing folder is an explicit act of
 * configuration, the same kind of act as choosing the root folder itself;
 * refusing to follow it would make the app lie about being a window onto
 * that folder. The one thing still rejected via the filesystem is a
 * symlink LOOP, which would otherwise hang a caller that follows the link
 * (e.g. `fs.stat` in `readTree`).
 *
 * Returns the original lexical path (not the resolved realpath), so
 * user-visible paths stay exactly as the user wrote them.
 *
 * TOCTOU note: the loop check happens before the caller's actual
 * read/write, not atomically with it — a symlink swapped in between could
 * still change what gets followed. Acceptable for a single-user local
 * app; not safe against a concurrent adversary.
 */
export async function resolveSafely(root: string, relative: string): Promise<string> {
  const lexicalTarget = resolveInRoot(root, relative)
  const absoluteRoot = path.resolve(root)

  if (lexicalTarget === absoluteRoot) return lexicalTarget

  // Walk the chain purely for loop detection; where it ultimately lands
  // (inside or outside root) is deliberately not checked here.
  await resolveRealish(lexicalTarget)

  return lexicalTarget
}
