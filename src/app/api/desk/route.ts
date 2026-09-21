import { NextResponse } from 'next/server'
import { loadConfig } from '@/lib/config'
import { readDesk } from '@/lib/fs/recent'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { root } = await loadConfig()
  return NextResponse.json(await readDesk(root))
}
