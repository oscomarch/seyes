import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { loadConfig } from '@/lib/config'
import { resolveSafely } from '@/lib/fs/paths'
import { sameOriginOnly, GuardError } from '../guard'

export const dynamic = 'force-dynamic'

/**
 * Show a note in the OS file manager.
 *
 * This is the one route that runs an external command, so it is deliberately
 * narrow: the only thing it can ever open is a path that `resolveSafely` has
 * already confirmed belongs to the writing folder, and the path is passed as
 * an argv entry rather than through a shell, so it cannot be interpreted as a
 * command however it is named.
 */
export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    const { path: relative } = await request.json()
    const { root } = await loadConfig()
    const target = await resolveSafely(root, relative)

    const [command, args]: [string, string[]] =
      process.platform === 'darwin'
        ? ['open', ['-R', target]]
        : process.platform === 'win32'
          ? ['explorer', [`/select,${target}`]]
          : ['xdg-open', [path.dirname(target)]]

    spawn(/*turbopackIgnore: true*/ command, args, { stdio: 'ignore', detached: true }).unref()
    return NextResponse.json({ ok: true })
  } catch (error) {
    const status = error instanceof GuardError ? 403 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
