import { useEffect, useRef, useState } from 'react'
import { laneColor, tint } from '../lib/theme.js'

export function Card({ as: Tag = 'section', className = '', children, ...props }) {
  return (
    <Tag className={`rounded-xl border border-line bg-panel p-4 ${className}`} {...props}>
      {children}
    </Tag>
  )
}

export function SectionTitle({ as: Tag = 'h2', className = '', children }) {
  return <Tag className={`m-0 text-xs font-medium tracking-[0.01em] text-muted ${className}`}>{children}</Tag>
}

export function Dot({ color, className = '' }) {
  return <span aria-hidden="true" className={`inline-block size-2 flex-none rounded-full ${className}`} style={{ background: color }} />
}

const buttonStyles = {
  primary: 'bg-fg text-ink hover:bg-fg/85',
  secondary: 'border border-line-strong bg-panel-2 text-fg hover:border-line-hover hover:bg-panel-3',
  ghost: 'text-soft hover:bg-panel-2 hover:text-fg',
  a: 'bg-branch-a text-ink hover:brightness-110',
  b: 'bg-branch-b text-ink hover:brightness-110',
}

export function Button({ variant = 'secondary', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`press inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

/** Small status label in any CSS color: outlined, or filled when `solid`. */
export function Badge({ color, solid = false, className = '', children }) {
  return (
    <span
      className={`inline-flex flex-none items-center rounded-full px-2 text-[11px] font-medium leading-[18px] ${className}`}
      style={solid ? { background: color, color: 'var(--color-ink)' } : { color, boxShadow: `inset 0 0 0 1px ${tint(color, 40)}` }}
    >
      {children}
    </span>
  )
}

/** A branch / tag / remote label chip. */
export function RefChip({ refInfo, lane }) {
  if (refInfo.type === 'tag') return <Badge color="var(--color-merge-base)">{refInfo.name}</Badge>
  if (refInfo.type === 'remote') return <Badge color="var(--color-muted)">{refInfo.name}</Badge>
  return (
    <Badge color={laneColor(lane)}>
      {refInfo.head && <span className="mr-1 opacity-70">HEAD</span>}
      {refInfo.name}
    </Badge>
  )
}

export function StatTile({ value, label, hint }) {
  return (
    <div className="rounded-lg bg-panel-2 px-3 py-2.5">
      <div className="text-lg font-semibold tabular-nums tracking-[-0.01em]">{value}</div>
      <div className="text-xs text-subtle">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] leading-tight text-muted">{hint}</div>}
    </div>
  )
}

export const fieldClass =
  'min-h-9 rounded-lg border border-line-strong bg-ink px-3 text-[13px] text-fg placeholder:text-muted transition-[border-color] duration-150 hover:border-line-hover focus:border-accent focus:outline-none'

export function Select({ id, label, value, onChange, options, className = '', labelExtra = null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs text-muted">
        {labelExtra}
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} font-mono ${className}`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

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
      className={`press inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-panel-2 px-2 text-xs text-subtle hover:text-fg ${className}`}
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
