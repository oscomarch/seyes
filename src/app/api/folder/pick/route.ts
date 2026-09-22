import { NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { loadConfig } from '@/lib/config'
import { sameOriginOnly, GuardError } from '../../guard'

export const dynamic = 'force-dynamic'

/*
 * The standard macOS folder picker, for Seyes running in a browser. A web page
 * can't learn the real path of a folder the user picks, but this server runs
 * on the same machine, so it can show the system dialog itself. The Mac app
 * uses its own native sheet instead and never calls this.
 *
 * The prompt and starting folder are passed as arguments to the script, never
 * spliced into its source, so no folder name can be read as AppleScript.
 */
const SCRIPT = [
  'on run argv',
  'tell me to activate',
  'return POSIX path of (choose folder with prompt (item 1 of argv) default location (POSIX file (item 2 of argv)))',
  'end run',
]

export async function POST(request: Request) {
  try {
    sameOriginOnly(request)
    if (process.platform !== 'darwin') {
      return NextResponse.json({ error: 'unsupported' }, { status: 501 })
    }
    const { prompt, start } = await request.json()
    const { root } = await loadConfig()
    const from = typeof start === 'string' && path.isAbsolute(start) ? start : path.dirname(root)
    const args = [...SCRIPT.flatMap((line) => ['-e', line]), String(prompt || 'Choose a folder'), from]

    const picked = await new Promise<string | null>((resolve, reject) => {
      execFile('osascript', args, (error, stdout, stderr) => {
        if (!error) return resolve(stdout.trim().replace(/\/$/, ''))
        // -128 is AppleScript's "User canceled", not a failure.
        if (/-128/.test(stderr)) return resolve(null)
        reject(new Error(stderr.trim() || error.message))
      })
    })
    return NextResponse.json(picked ? { path: picked } : { cancelled: true })
  } catch (error) {
    const status = error instanceof GuardError ? 403 : 400
    return NextResponse.json({ error: (error as Error).message }, { status })
  }
}
