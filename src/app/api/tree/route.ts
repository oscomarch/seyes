import { NextResponse } from 'next/server'
import { loadConfig } from '@/lib/config'
import { readTree } from '@/lib/fs/tree'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { root } = await loadConfig()
  return NextResponse.json({ root, tree: await readTree(root) })
}
