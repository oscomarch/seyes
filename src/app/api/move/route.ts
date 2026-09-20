import { NextResponse } from 'next/server'
import { loadConfig } from '@/lib/config'
import { movePath } from '@/lib/fs/notes'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { from, to } = await request.json()
    const { root } = await loadConfig()
    await movePath(root, from, to)
    return NextResponse.json({ ok: true, path: to })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
