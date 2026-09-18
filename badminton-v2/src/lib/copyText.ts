/**
 * Copies text to the clipboard, returning whether it actually landed there.
 *
 * Two paths on purpose. `navigator.clipboard.writeText` is the modern one but it
 * rejects outright on an insecure origin and inside the in-app webviews players
 * open links from (Messenger, Instagram) — exactly the phones this app runs on.
 * `execCommand('copy')` is deprecated and still the only thing that works there,
 * so it is the fallback rather than the primary.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Permission denied or no Clipboard API — try the legacy path below.
  }

  const el = document.createElement('textarea')
  el.value = text
  el.setAttribute('readonly', '')
  // Off-screen but still focusable; `display: none` would make select() a no-op.
  el.style.position = 'fixed'
  el.style.top = '0'
  el.style.opacity = '0'
  el.style.pointerEvents = 'none'

  try {
    document.body.appendChild(el)
    el.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    el.remove()
  }
}
