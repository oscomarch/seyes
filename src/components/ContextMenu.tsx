'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type MenuItem =
  | { label: string; onSelect: () => void; danger?: boolean; hint?: string }
  | 'separator'

/**
 * A small menu at a point on screen: the right-click menu, and the one the
 * row's ⋯ button opens. It keeps itself inside the window and closes on
 * Escape, on any click outside it, or when the page scrolls under it.
 */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const box = menu.current?.getBoundingClientRect()
    if (!box) return
    // Measured once on open to keep the menu on screen; not a render cascade.
    setAt({
      left: Math.max(4, Math.min(x, window.innerWidth - box.width - 4)),
      top: Math.max(4, Math.min(y, window.innerHeight - box.height - 4)),
    })
  }, [x, y])

  useEffect(() => {
    menu.current?.querySelector('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const buttons = Array.from(menu.current?.querySelectorAll('button') ?? [])
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const step = event.key === 'ArrowDown' ? 1 : -1
        buttons[(index + step + buttons.length) % buttons.length]?.focus()
      }
    }
    const onDown = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    document.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
      document.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return (
    <div ref={menu} className="menu" role="menu" style={at} onContextMenu={(event) => event.preventDefault()}>
      {items.map((item, index) =>
        item === 'separator' ? (
          <div key={index} className="menu-separator" />
        ) : (
          <button
            key={item.label}
            role="menuitem"
            className={item.danger ? 'danger' : ''}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            <span>{item.label}</span>
            {item.hint && <kbd>{item.hint}</kbd>}
          </button>
        ),
      )}
    </div>
  )
}
