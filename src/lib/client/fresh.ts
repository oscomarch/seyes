/**
 * The note that was just created, so the editor can put the cursor in its
 * title the moment it opens: you type the name, press Enter, and you are
 * writing. Every way of creating a note (the button, ⌘N, the menus, the
 * desk) marks it here; the editor takes the mark once.
 */
let fresh: string | null = null

export function markFresh(path: string) {
  fresh = path
}

export function takeFresh(path: string): boolean {
  if (fresh !== path) return false
  fresh = null
  return true
}
