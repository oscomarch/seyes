import { NextResponse } from 'next/server'
import { loadConfig } from '@/lib/config'
import { searchNotes } from '@/lib/fs/search'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q') ?? ''
  const { root } = await loadConfig()
  return NextResponse.json({ hits: await searchNotes(root, query) })
}
