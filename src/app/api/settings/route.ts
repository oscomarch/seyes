import { NextResponse } from 'next/server'
import { loadConfig, saveConfig } from '@/lib/config'
import { sameOriginOnly, GuardError } from '../guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await loadConfig())
}

export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    const { root } = await request.json()
    if (typeof root !== 'string' || !root.trim()) throw new Error('A root folder is required')
    await saveConfig({ root: root.trim() })
    return NextResponse.json(await loadConfig())
  } catch (error) {
    const status = error instanceof GuardError ? 403 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
