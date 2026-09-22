import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { loadConfig, switchRoot } from '@/lib/config'
import { moveFolder, describeFolder, isInICloud, displayPath } from '@/lib/fs/folder'
import { sameOriginOnly, GuardError } from '../../guard'

export const dynamic = 'force-dynamic'

/** Move the whole writing folder into another folder, and follow it there. */
export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    const { into, allowICloud } = await request.json()
    if (typeof into !== 'string' || !path.isAbsolute(into)) throw new Error('Choose where to move the folder')
    const { root } = await loadConfig()
    const target = path.join(path.resolve(into), path.basename(root))

    if (target === root) return NextResponse.json({ unchanged: true, folder: describeFolder(root) })

    // Writing that lives only on this Mac should never end up in iCloud by
    // accident, one stray click on Choose away. Ask first.
    if (isInICloud(target) && !isInICloud(root) && !allowICloud) {
      return NextResponse.json({ confirm: 'icloud', display: displayPath(target) }, { status: 409 })
    }

    const moved = await moveFolder(root, into)
    await switchRoot(moved, { forget: true })
    // The open page watches the old folder and may ask for its tree in the
    // instant before the switch, which recreates it empty. rmdir only ever
    // removes an empty folder, so this can't take a note with it.
    await fs.rmdir(root).catch(() => {})
    return NextResponse.json({ folder: describeFolder(moved) })
  } catch (error) {
    const status = error instanceof GuardError ? 403 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
