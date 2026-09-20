'use client'
import { createSlashExtension, type SlashItem } from '@/lib/editor/slash'

/**
 * A plain DOM popup rather than a React portal: the suggestion plugin lives
 * outside React's tree, and this keeps the wiring to a dozen lines.
 */
export function slashExtension() {
  return createSlashExtension(() => {
    let element: HTMLDivElement
    let items: SlashItem[] = []
    let selected = 0
    let command: (item: SlashItem) => void

    const paint = () => {
      element.innerHTML = ''
      items.forEach((item, index) => {
        const row = document.createElement('button')
        row.className = 'slash-row' + (index === selected ? ' on' : '')
        row.innerHTML = `<span class="slash-title"></span><span class="slash-hint"></span>`
        row.querySelector('.slash-title')!.textContent = item.title
        row.querySelector('.slash-hint')!.textContent = item.hint
        row.onmousedown = (event) => {
          event.preventDefault()
          command(item)
        }
        element.appendChild(row)
      })
      element.style.display = items.length ? 'block' : 'none'
    }

    const place = (rect: DOMRect | null) => {
      if (!rect) return
      element.style.top = `${rect.bottom + 6}px`
      element.style.left = `${rect.left}px`
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-suggestion ships no exported prop types for render()
      onStart: (props: any) => {
        element = document.createElement('div')
        element.className = 'slash'
        document.body.appendChild(element)
        items = props.items
        command = props.command
        selected = 0
        paint()
        place(props.clientRect?.())
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-suggestion ships no exported prop types for render()
      onUpdate: (props: any) => {
        items = props.items
        command = props.command
        selected = 0
        paint()
        place(props.clientRect?.())
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiptap-suggestion ships no exported prop types for render()
      onKeyDown: (props: any) => {
        if (props.event.key === 'ArrowDown') {
          selected = (selected + 1) % items.length
          paint()
          return true
        }
        if (props.event.key === 'ArrowUp') {
          selected = (selected - 1 + items.length) % items.length
          paint()
          return true
        }
        if (props.event.key === 'Enter') {
          if (items[selected]) command(items[selected])
          return true
        }
        if (props.event.key === 'Escape') {
          element.remove()
          return true
        }
        return false
      },
      onExit: () => element.remove(),
    }
  })
}
