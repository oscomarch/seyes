import { NextResponse } from 'next/server'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { loadConfig, switchRoot, isConfigured, defaultRoot } from '@/lib/config'
import { describeFolder, isInICloud, displayPath } from '@/lib/fs/folder'
import { sameOriginOnly, GuardError } from '../guard'

export const dynamic = 'force-dynamic'

/** Where the writing lives, and the folders used before it. */
async function summary() {
  const config = await loadConfig()
  const recent = (config.recent ?? []).filter((entry) => existsSync(entry) && statSync(entry).isDirectory())
  return { root: config.root, folder: describeFolder(config.root), recent: recent.map(describeFolder) }
}

export async function GET() {
  // Before the first run's choice, report without loadConfig, which would
  // create the default folder before anyone agreed to it.
  if (!(await isConfigured())) {
    return NextResponse.json({ configured: false, suggested: describeFolder(defaultRoot()) })
  }
  return NextResponse.json({ configured: true, ...(await summary()) })
}

/** Open another folder. The notes in the current one stay where they are. */
export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    const { root, allowICloud } = await request.json()
    if (typeof root !== 'string' || !root.trim()) throw new Error('A root folder is required')
    if (!path.isAbsolute(root.trim())) throw new Error('Use a full path, like /Users/you/Writing')
    const current = await loadConfig()
    if (isInICloud(root.trim()) && !isInICloud(current.root) && !allowICloud) {
      return NextResponse.json({ confirm: 'icloud', display: displayPath(root.trim()) }, { status: 409 })
    }
    await switchRoot(root.trim())
    return NextResponse.json(await summary())
  } catch (error) {
    const status = error instanceof GuardError ? 403 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
