import path from 'node:path'

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
