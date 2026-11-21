import { useEffect, useRef, useState } from 'react'
import { COL, laneColor, tint } from '../lib/theme.js'

// Type scale (after GitHub Primer): 12 meta/data · 14 body · 16 titles · 24 statements, normal letter-spacing.
// Color is for data; chrome stays neutral.

export function Dot({ color, className = '' }) {
  return <span aria-hidden="true" className={`inline-block size-2 flex-none rounded-full ${className}`} style={{ background: color }} />
}

const buttonStyles = {
  primary: 'bg-fg text-ink hover:bg-fg/85',
  secondary: 'border border-line-strong bg-panel text-fg hover:border-line-hover hover:bg-panel-2',
  ghost: 'text-soft hover:bg-panel-2 hover:text-fg',
}

export function Button({ variant = 'secondary', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`press inline-flex min-h-8 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

/** Small label in any CSS color: outlined, or filled when `solid`. Used sparingly (HEAD, merge-base). */
export function Badge({ color, solid = false, className = '', children }) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 rounded-[5px] px-1.5 font-mono text-xs font-medium leading-[18px] ${className}`}
      style={solid ? { background: color, color: 'var(--color-ink)' } : { color, boxShadow: `inset 0 0 0 1px ${tint(color, 40)}` }}
    >
      {children}
    </span>
  )
}

const TagIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
    <circle cx="8" cy="8" r="1.5" />
  </svg>
)

/** A ref as plain colored text. Only the checked-out branch (HEAD) gets a filled label. */
export function RefChip({ refInfo, lane }) {
  if (refInfo.type === 'branch' && refInfo.head) {
    return (
      <Badge color={laneColor(lane)} solid>
        <span className="opacity-60">HEAD</span>
        {refInfo.name}
      </Badge>
    )
  }
  const color = refInfo.type === 'tag' ? COL.mergeBase : refInfo.type === 'remote' ? COL.muted : laneColor(lane)
  return (
    <span className="inline-flex flex-none items-center gap-1 font-mono text-xs" style={{ color }}>
      {refInfo.type === 'tag' ? <TagIcon /> : <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: color }} />}
      {refInfo.name}
    </span>
  )
}

export function Kbd({ children }) {
  return (
    <kbd className="inline-grid min-w-[18px] place-items-center rounded border border-line-strong bg-panel-2 px-1 font-mono text-xs leading-[16px] text-soft">
      {children}
    </kbd>
  )
}

/** Hover / focus card. Waits a beat before opening (no accidental flashes), closes at once, grows from its corner. */
export function HoverCard({ trigger, children, align = 'right', className = '' }) {
  return (
    <div className={`group relative ${className}`}>
      {trigger}
      <div
        role="tooltip"
        className={`pointer-events-none absolute top-[calc(100%+6px)] z-40 w-72 scale-[0.97] rounded-xl border border-line-strong bg-panel p-3 opacity-0 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-[opacity,transform] delay-0 duration-150 ease-out-strong group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100 group-hover:delay-200 ${
          align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

export const fieldClass =
  'min-h-8 rounded-lg border border-line-strong bg-panel px-2.5 text-sm text-fg placeholder:text-muted transition-[border-color] duration-150 hover:border-line-hover focus:border-accent focus:outline-none'

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

/** Copies `text`; the icon cross-fades (with a little blur so the two states read as one) to a check. */
export function CopyButton({ text, label = 'Copy', children = null, className = '' }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard not available; the text is still selectable */
    }
  }

  const layer = 'col-start-1 row-start-1 transition-[opacity,filter,transform] duration-200 ease-out-strong'
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={children ? undefined : label}
      className={`press inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-panel px-2 text-sm font-medium text-subtle hover:bg-panel-2 hover:text-fg ${className}`}
    >
      <span className="grid place-items-center">
        <span className={`${layer} ${copied ? 'scale-75 opacity-0 blur-[2px]' : ''}`}><CopyIcon /></span>
        <span className={`${layer} text-path ${copied ? '' : 'scale-75 opacity-0 blur-[2px]'}`}><CheckIcon /></span>
      </span>
      {children && <span>{copied ? 'Copied' : children}</span>}
      <span className="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</span>
    </button>
  )
}
