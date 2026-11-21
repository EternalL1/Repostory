import { useLayoutEffect, useRef, useState } from 'react'
import { COL } from '../lib/theme.js'

export const TABS = [
  { id: 'load', label: 'Load' },
  { id: 'graph', label: 'Graph' },
  { id: 'compare', label: 'Compare' },
  { id: 'team', label: 'Team' },
]

export function Logo({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M5 3v16M5 8c0 4 12 2 12 7" stroke={COL.accent} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="5" cy="4" r="2.6" fill={COL.accent} />
      <circle cx="5" cy="18" r="2.6" fill={COL.path} />
      <circle cx="17" cy="16" r="2.6" fill={COL.merge} />
    </svg>
  )
}

/** Segmented control: the active pill slides from the previous tab, so the change has a direction. */
function Tabs({ tab, onTab }) {
  const refs = useRef(new Map())
  const [pill, setPill] = useState(null)
  const measured = useRef(false)

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current.get(tab)
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [tab])

  // first paint places the pill without animating it in from nowhere
  const animate = measured.current
  if (pill) measured.current = true

  return (
    <nav aria-label="Main" className="relative flex rounded-[10px] bg-panel-2 p-[3px]">
      {pill && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-[3px] left-0 rounded-[7px] bg-[#262c35] shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_0_0_1px_rgba(255,255,255,0.06)] ${
            animate ? 'transition-[transform,width] duration-200 ease-out-strong' : ''
          }`}
          style={{ width: pill.w, transform: `translateX(${pill.x}px)` }}
        />
      )}
      {TABS.map((t) => {
        const active = t.id === tab
        return (
          <button
            key={t.id}
            ref={(el) => { if (el) refs.current.set(t.id, el); else refs.current.delete(t.id) }}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onTab(t.id)}
            className={`relative min-h-8 cursor-pointer rounded-[7px] px-3.5 text-[13px] font-medium transition-colors duration-150 ${
              active ? 'text-fg' : 'text-muted hover:text-subtle'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}

export default function Header({ tab, onTab, model }) {
  return (
    <header className="material sticky top-0 z-20 border-b border-white/[0.06]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-2.5 sm:px-8">
        <div className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <Logo />
          RepoGraph
        </div>
        <Tabs tab={tab} onTab={onTab} />
        {model && (
          <div className="ml-auto flex min-w-0 items-center gap-2 text-xs text-muted">
            <span className="truncate font-mono text-subtle">{model.name}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap tabular-nums">{model.stats.commits} commits</span>
            <span aria-hidden="true" className="max-sm:hidden">·</span>
            <span className="whitespace-nowrap tabular-nums max-sm:hidden">
              {model.authorCount} {model.authorCount === 1 ? 'author' : 'authors'}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
