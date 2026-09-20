import { NextResponse } from 'next/server'
import { loadConfig } from '@/lib/config'
import { trashPath } from '@/lib/fs/notes'
import { sameOriginOnly, GuardError } from '../guard'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    const { path: relative } = await request.json()
    const { root } = await loadConfig()
    await trashPath(root, relative)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const status = error instanceof GuardError ? 403 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
