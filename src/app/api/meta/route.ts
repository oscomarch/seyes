import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import { loadConfig } from '@/lib/config'
import { resolveSafely } from '@/lib/fs/paths'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const relative = new URL(request.url).searchParams.get('path') ?? ''
  try {
    const { root } = await loadConfig()
    const target = await resolveSafely(root, relative)
    const [stat, content] = await Promise.all([fs.stat(target), fs.readFile(target, 'utf8')])
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    return NextResponse.json({
      path: target,
      created: stat.birthtime.toISOString(),
      modified: stat.mtime.toISOString(),
      bytes: stat.size,
      words,
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
