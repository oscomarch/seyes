import { NextResponse } from 'next/server'
import { loadConfig } from '@/lib/config'
import { readNote, writeNote, createNote, createFolder } from '@/lib/fs/notes'
import { sameOriginOnly, GuardError } from '../guard'

export const dynamic = 'force-dynamic'

function fail(error: unknown) {
  const status = error instanceof GuardError ? 403 : 400
  return NextResponse.json({ error: (error as Error).message }, { status })
}

export async function GET(request: Request) {
  const relative = new URL(request.url).searchParams.get('path') ?? ''
  try {
    const { root } = await loadConfig()
    return NextResponse.json({ content: await readNote(root, relative) })
  } catch (error) {
    return fail(error)
  }
}

export async function PUT(request: Request) {
  try {
    sameOriginOnly(request)
    const { path: relative, content } = await request.json()
    const { root } = await loadConfig()
    await writeNote(root, relative, content)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}

export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    const { folder = '', name, kind } = await request.json()
    const { root } = await loadConfig()
    const created =
      kind === 'folder'
        ? await createFolder(root, folder, name || 'New folder')
        : await createNote(root, folder, name || 'Untitled')
    return NextResponse.json({ path: created })
  } catch (error) {
    return fail(error)
  }
}
