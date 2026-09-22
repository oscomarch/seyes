type Bridge = { postMessage: (message: unknown) => void }

function nativeBridge(): Bridge | null {
  const w = window as unknown as { webkit?: { messageHandlers?: { chrome?: Bridge } } }
  return w.webkit?.messageHandlers?.chrome ?? null
}

/**
 * Ask for a folder with the real macOS picker, and get back its full path.
 * Inside the Mac app that is a native sheet on the window. In a browser the
 * page can't see real paths, so the local server shows the system dialog on
 * its behalf. Resolves to null when the user cancels.
 *
 * `start` is where the picker opens. Without it macOS opens in Documents, so
 * one careless click on Choose would move the writing folder into iCloud.
 */
export async function pickFolder(prompt: string, start?: string): Promise<string | null> {
  const bridge = nativeBridge()
  if (bridge) {
    const id = Math.random().toString(36).slice(2)
    return new Promise((resolve) => {
      const onPicked = (event: Event) => {
        const detail = (event as CustomEvent<{ id: string; path: string | null }>).detail
        if (detail?.id !== id) return
        window.removeEventListener('seyes:picked', onPicked)
        resolve(detail.path)
      }
      window.addEventListener('seyes:picked', onPicked)
      bridge.postMessage({ type: 'pickFolder', id, prompt, start })
    })
  }

  const response = await fetch('/api/folder/pick', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, start }),
  })
  if (response.status === 501) {
    // Not a Mac, so no system picker to borrow. Typing the path still works.
    return window.prompt(`${prompt}\n\nType the full path of the folder.`)?.trim() || null
  }
  const data = await response.json()
  if (data.error) throw new Error(data.error)
  return data.path ?? null
}
