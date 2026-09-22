import { NextResponse } from 'next/server'
import path from 'node:path'
import { switchRoot } from '@/lib/config'
import { describeFolder } from '@/lib/fs/folder'
import { seedIfEmpty } from '@/lib/fs/welcome'
import { sameOriginOnly, GuardError } from '../guard'

export const dynamic = 'force-dynamic'

/** The first launch's one question: where the writing lives. */
export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    const { root } = await request.json()
    if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('Choose a folder for your writing')
    const config = await switchRoot(root, { forget: true })
    await seedIfEmpty(config.root)
    return NextResponse.json({ folder: describeFolder(config.root) })
  } catch (error) {
    const status = error instanceof GuardError ? 403 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
