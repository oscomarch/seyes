import { NextResponse } from 'next/server'
import { loadConfig } from '@/lib/config'
import { trashPath } from '@/lib/fs/notes'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { path: relative } = await request.json()
    const { root } = await loadConfig()
    await trashPath(root, relative)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
