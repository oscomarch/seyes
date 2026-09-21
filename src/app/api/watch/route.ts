import fs from 'node:fs'
import { loadConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

/**
 * A live feed of "something in your folder changed".
 *
 * Seyes claims to be a window onto a folder, and a window that only updates
 * when you reload is not one. This watches the writing folder and pushes a
 * nudge to the browser, so a file you rename in Finder, a note edited in
 * another app, or a folder dropped in from anywhere shows up immediately.
 *
 * It deliberately sends no detail about what changed. The client re-reads the
 * tree itself, which keeps the filesystem the single source of truth and
 * means a missed or coalesced event can never leave the UI out of step.
 */
export async function GET(request: Request) {
  const { root } = await loadConfig()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      const send = (event: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${event}\n\n`))
        } catch {
          closed = true
        }
      }

      send('ready')

      // Editors and sync tools fire several events for one logical save, so
      // changes are coalesced into a single nudge.
      let pending: ReturnType<typeof setTimeout> | null = null
      let watcher: fs.FSWatcher | null = null
      try {
        watcher = fs.watch(root, { recursive: true }, () => {
          if (pending) clearTimeout(pending)
          pending = setTimeout(() => send('changed'), 150)
        })
      } catch {
        // Recursive watching is unavailable on this platform. The app still
        // works, it just will not notice outside edits on its own.
        send('unsupported')
      }

      // Proxies and browsers drop idle streams; this keeps it open.
      const keepalive = setInterval(() => send('ping'), 25_000)

      const stop = () => {
        closed = true
        watcher?.close()
        clearInterval(keepalive)
        if (pending) clearTimeout(pending)
        try {
          controller.close()
        } catch {
          // Already closed by the runtime.
        }
      }

      request.signal.addEventListener('abort', stop)
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
