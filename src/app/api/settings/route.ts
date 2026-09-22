import { NextResponse } from 'next/server'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { loadConfig, switchRoot } from '@/lib/config'
import { describeFolder } from '@/lib/fs/folder'
import { sameOriginOnly, GuardError } from '../guard'

export const dynamic = 'force-dynamic'

/** Where the writing lives, and the folders used before it. */
async function summary() {
  const config = await loadConfig()
  const recent = (config.recent ?? []).filter((entry) => existsSync(entry) && statSync(entry).isDirectory())
  return { root: config.root, folder: describeFolder(config.root), recent: recent.map(describeFolder) }
}

export async function GET() {
  return NextResponse.json(await summary())
}

/** Open another folder. The notes in the current one stay where they are. */
export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    const { root } = await request.json()
    if (typeof root !== 'string' || !root.trim()) throw new Error('A root folder is required')
    if (!path.isAbsolute(root.trim())) throw new Error('Use a full path, like /Users/you/Writing')
    await switchRoot(root.trim())
    return NextResponse.json(await summary())
  } catch (error) {
    const status = error instanceof GuardError ? 403 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
