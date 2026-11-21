import { laneColor } from '../lib/theme.js'

export function Card({ className = '', children, ...props }) {
  return (
    <section className={`rounded-xl border border-line bg-panel p-4 ${className}`} {...props}>
      {children}
    </section>
  )
}

export function SectionTitle({ as: Tag = 'h2', className = '', children }) {
  return (
    <Tag className={`m-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted ${className}`}>{children}</Tag>
  )
}

export function Dot({ color, className = '' }) {
  return <span aria-hidden="true" className={`inline-block size-2.5 flex-none rounded-full ${className}`} style={{ background: color }} />
}

const buttonStyles = {
  primary: 'bg-accent text-ink hover:brightness-110',
  secondary: 'border border-line bg-panel-2 text-fg hover:bg-[#232c3b]',
  a: 'bg-branch-a text-ink hover:brightness-110',
  b: 'bg-branch-b text-ink hover:brightness-110',
}

export function Button({ variant = 'secondary', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  )
}

/** A branch / tag / remote label chip. */
export function RefChip({ refInfo, lane }) {
  if (refInfo.type === 'tag') {
    return (
      <span className="flex-none rounded-full border border-merge-base/50 px-2 text-[11px] font-semibold leading-[18px] text-merge-base">
        {refInfo.name}
      </span>
    )
  }
  if (refInfo.type === 'remote') {
    return (
      <span className="flex-none rounded-full border border-line px-2 text-[11px] font-semibold leading-[18px] text-muted">
        {refInfo.name}
      </span>
    )
  }
  const color = laneColor(lane)
  return (
    <span
      className="flex-none rounded-full border px-2 text-[11px] font-semibold leading-[18px]"
      style={{ color, borderColor: `${color}80` }}
    >
      {refInfo.head ? 'HEAD → ' : ''}
      {refInfo.name}
    </span>
  )
}

export function StatTile({ value, label, hint }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-2.5 py-2">
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-xs text-subtle">{label}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  )
}

export function Select({ id, label, value, onChange, options, className = '', labelExtra = null }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs text-muted">
        {labelExtra}
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-h-11 rounded-lg border border-line bg-panel px-2.5 font-mono text-[13px] text-fg ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
