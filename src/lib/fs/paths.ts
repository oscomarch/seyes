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
 * Resolve `path` to its real location, following symlinks (including
 * chains of them) via `lstat`/`readlink` rather than `fs.realpath`, so that
 * a trailing segment which does not exist yet (or a *broken* symlink whose
 * target does not exist) is tolerated instead of throwing: the former is
 * required to support creating new files, and the latter is required to
 * still detect that a broken symlink's target escapes the root. `seen`
 * guards against symlink cycles.
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

  // `seen` tracks symlinks on the CURRENT resolution stack, not every
  // symlink ever visited: the same real symlink (e.g. macOS's /tmp) can
  // legitimately appear in two unrelated branches of one resolution (once
  // for the root's own ancestry, again for a separate symlink's target),
  // and that must not be mistaken for a cycle.
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
 * Resolve a user-supplied relative path against the root folder, verifying
 * containment against the real filesystem so a symlink cannot be used to
 * escape the root. `resolveInRoot` alone only reasons about the path
 * string: it cannot see a symlink planted inside the root that points
 * outside it. This runs that cheap lexical check first, then confirms the
 * real (symlink-resolved) location still sits inside the real root, and
 * returns the original lexical path (not the realpath) on success.
 *
 * TOCTOU note: containment is verified before the caller performs its
 * actual read/write, not atomically with it. A symlink swapped in between
 * this check and that operation could still escape. Acceptable for a
 * single-user local app; not safe against a concurrent adversary.
 */
export async function resolveSafely(root: string, relative: string): Promise<string> {
  const lexicalTarget = resolveInRoot(root, relative)
  const absoluteRoot = path.resolve(root)

  if (lexicalTarget === absoluteRoot) return lexicalTarget

  const realRoot = await resolveRealish(absoluteRoot)
  const realTarget = await resolveRealish(lexicalTarget)

  if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
    throw new PathEscapeError(relative)
  }

  return lexicalTarget
}
