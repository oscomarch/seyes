/**
 * A short message at the bottom of the window, instead of alert(). Native
 * dialogs block the page, and inside the Mac app's web view they don't appear
 * at all unless the app implements them, so an error would vanish silently.
 */
export function notify(message: string, tone: 'info' | 'error' = 'info') {
  window.dispatchEvent(new CustomEvent('seyes:notify', { detail: { message, tone } }))
}
