/**
 * Inline SVG icon set — replaces emoji iconography.
 *
 * Why not emoji: emoji render differently on every OS, vary wildly in visual
 * weight, and pull against the clinical "independent inspector" brand voice.
 * These icons are a single stroke style (1.7px, round caps), inherit color
 * via currentColor, and render identically everywhere.
 *
 * All icons are decorative by default (aria-hidden) — pair them with visible
 * text labels, never use them as the sole label.
 */

import type { CategoryId } from '@/lib/types'

interface IconProps {
  size?:      number
  className?: string
}

function Svg({ size = 20, className = '', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// ─── Category icons ───────────────────────────────────────────────────────────

export function ThermometerIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0Z" />
      <path d="M12 16v-5" />
    </Svg>
  )
}

export function DropletIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5s6 6.2 6 10.5a6 6 0 1 1-12 0c0-4.3 6-10.5 6-10.5Z" />
    </Svg>
  )
}

export function BoltIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" />
    </Svg>
  )
}

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v11h13V9" />
    </Svg>
  )
}

export function LayersIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3.5 12.5 8.5 4.7 8.5-4.7" />
      <path d="m3.5 16.5 8.5 4.7 8.5-4.7" />
    </Svg>
  )
}

export function PlugIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 3v5M15 3v5" />
      <path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8Z" />
      <path d="M12 16.5V21" />
    </Svg>
  )
}

export function BugIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 8a4 4 0 0 1 4 4v3a4 4 0 0 1-8 0v-3a4 4 0 0 1 4-4Z" />
      <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0" />
      <path d="M12 9v10M4.5 12.5H8M16 12.5h3.5M5.5 18l2.7-1.5M18.5 18l-2.7-1.5M5.5 7.5 8.2 9.5M18.5 7.5 15.8 9.5" />
    </Svg>
  )
}

export function WrenchIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.5 6.5a4.5 4.5 0 0 0-6 5.3L3 17.3a2 2 0 1 0 2.8 2.9l5.5-5.6a4.5 4.5 0 0 0 5.3-6l-3 3-2.5-.7-.7-2.5 3.1-2.9Z" />
    </Svg>
  )
}

export const CATEGORY_ICONS: Record<CategoryId, (p: IconProps) => JSX.Element> = {
  hvac:        ThermometerIcon,
  plumbing:    DropletIcon,
  electrical:  BoltIcon,
  roofing:     HomeIcon,
  foundation:  LayersIcon,
  appliances:  PlugIcon,
  pest:        BugIcon,
  maintenance: WrenchIcon,
}

// ─── Flow / trust / utility icons ─────────────────────────────────────────────

export function SearchIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m15.8 15.8 4.7 4.7" />
    </Svg>
  )
}

export function ClipboardIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v13.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15" />
      <rect x="9" y="3" width="6" height="3.5" rx="1" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </Svg>
  )
}

export function ScaleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4v16M8 20h8M12 4 5.5 6.5M12 4l6.5 2.5" />
      <path d="M5.5 6.5 3 12.5a2.8 2.8 0 0 0 5 0l-2.5-6ZM18.5 6.5 16 12.5a2.8 2.8 0 0 0 5 0l-2.5-6Z" />
    </Svg>
  )
}

export function ShieldIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 5 5.8v5.4c0 4.4 3 8.1 7 9.3 4-1.2 7-4.9 7-9.3V5.8L12 3Z" />
      <path d="m9 11.8 2.2 2.2L15.2 10" />
    </Svg>
  )
}

export function DocumentIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4M9.5 12h5M9.5 15.5h5" />
    </Svg>
  )
}

export function ChatIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.4A7.5 7.5 0 1 1 20 11.5Z" />
    </Svg>
  )
}

export function PaperclipIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m17.5 11.5-6.2 6.2a4 4 0 0 1-5.7-5.7l7.3-7.3a2.7 2.7 0 0 1 3.8 3.8l-7.2 7.2a1.4 1.4 0 0 1-2-2l6.3-6.3" />
    </Svg>
  )
}

export function PlusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function AlertTriangleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </Svg>
  )
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  )
}
