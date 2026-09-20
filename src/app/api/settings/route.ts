import { NextResponse } from 'next/server'
import { loadConfig, saveConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await loadConfig())
}

export async function POST(request: Request) {
  try {
    const { root } = await request.json()
    if (typeof root !== 'string' || !root.trim()) throw new Error('A root folder is required')
    await saveConfig({ root: root.trim() })
    return NextResponse.json(await loadConfig())
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
