/**
 * Small hand-drawn-feeling icon set. All 16x16, stroke-only, no fills,
 * no external icon library. Kept deliberately slightly imperfect
 * (rounded joins, plain strokes) rather than pixel-crisp and glossy.
 */

const common = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function NewNoteIcon({ title }: { title: string }) {
  return (
    <svg {...common} role="img" aria-label={title}>
      <title>{title}</title>
      <path d="M3.5 1.5h6l3 3v10h-9v-13z" />
      <path d="M9.5 1.5v3h3" />
      <path d="M9 11.5h2M6 11.5h1" />
    </svg>
  )
}

export function NewFolderIcon({ title }: { title: string }) {
  return (
    <svg {...common} role="img" aria-label={title}>
      <title>{title}</title>
      <path d="M1.5 3.5h4l1.3 1.6h7.2v9.4h-12.5v-11z" />
      <path d="M10.5 8.7v4M8.5 10.7h4" />
    </svg>
  )
}

export function PanelToggleIcon({ title }: { title: string }) {
  return (
    <svg {...common} role="img" aria-label={title}>
      <title>{title}</title>
      <rect x="1.75" y="2.5" width="12.5" height="11" rx="0.5" />
      <path d="M6 2.5v11" />
    </svg>
  )
}

export function SettingsIcon({ title }: { title: string }) {
  return (
    <svg {...common} role="img" aria-label={title}>
      <title>{title}</title>
      <path d="M6.7 1.8h2.6l.3 1.85 1.2.7 1.75-.66 1.3 2.26-1.4 1.22v1.4l1.4 1.22-1.3 2.26-1.75-.66-1.2.7-.3 1.85H6.7l-.3-1.85-1.2-.7-1.75.66-1.3-2.26 1.4-1.22v-1.4l-1.4-1.22 1.3-2.26 1.75.66 1.2-.7z" />
      <circle cx="8" cy="8" r="2.05" />
    </svg>
  )
}
