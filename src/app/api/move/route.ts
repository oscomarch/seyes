import { NextResponse } from 'next/server'
import { loadConfig } from '@/lib/config'
import { movePath } from '@/lib/fs/notes'
import { sameOriginOnly, GuardError } from '../guard'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    const { from, to } = await request.json()
    const { root } = await loadConfig()
    await movePath(root, from, to)
    return NextResponse.json({ ok: true, path: to })
  } catch (error) {
    const status = error instanceof GuardError ? 403 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
