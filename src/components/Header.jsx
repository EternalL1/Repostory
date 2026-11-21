import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PixelLogo } from './pixel.jsx'

export const TABS = [
  { id: 'load', label: 'Load' },
  { id: 'graph', label: 'Graph' },
  { id: 'compare', label: 'Compare' },
  { id: 'team', label: 'Team' },
  { id: 'story', label: 'Story' },
]

// Repostory's mark is pixel art (components/pixel.jsx)
export const Logo = PixelLogo

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
    <nav aria-label="Main" className="relative flex rounded-[10px] bg-panel-2 p-[3px] max-sm:order-2">
      {pill && (
        <span
          aria-hidden="true"
          className={`absolute inset-y-[3px] left-0 rounded-[7px] bg-pill shadow-[0_1px_2px_rgba(0,0,0,0.18),inset_0_0_0_1px_color-mix(in_srgb,var(--color-fg)_8%,transparent)] ${
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
            className={`relative min-h-8 cursor-pointer rounded-[7px] px-3.5 text-sm font-medium transition-colors duration-150 ${
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

const THEME_KEY = 'repograph.theme' // earlier app name, kept so saved choices survive
const THEMES = ['system', 'light', 'dark']
const THEME_LABEL = { system: 'System', light: 'Light', dark: 'Dark' }

const ThemeIcons = {
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
}

function readTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY)
    return THEMES.includes(t) ? t : 'system'
  } catch {
    return 'system'
  }
}

/** Cycles System → Light → Dark. "System" follows the OS; a pick is remembered on this device. */
function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
  }, [theme])

  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
  const layer = 'col-start-1 row-start-1 transition-[opacity,filter,transform] duration-200 ease-out-strong'
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[next]}`}
      title={`Theme: ${THEME_LABEL[theme]}`}
      className="press grid size-8 flex-none cursor-pointer place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
    >
      {THEMES.map((t) => (
        <svg
          key={t}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`${layer} ${t === theme ? '' : 'scale-75 opacity-0 blur-[2px]'}`}
        >
          {ThemeIcons[t]}
        </svg>
      ))}
    </button>
  )
}

export default function Header({ tab, onTab, model }) {
  const ref = useRef(null)

  // publish the header height so app-shell pages can fill exactly the rest of the window
  useLayoutEffect(() => {
    const el = ref.current
    const set = () => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <header ref={ref} className="material sticky top-0 z-30 border-b border-line">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-2.5 sm:px-8">
        <div className="flex items-center gap-2 text-base font-semibold">
          <Logo />
          Repostory
        </div>
        <Tabs tab={tab} onTab={onTab} />
        {model && (
          <div className="ml-auto flex min-w-0 items-center gap-2 text-xs text-muted max-sm:order-last max-sm:ml-0 max-sm:basis-full">
            <span className="truncate font-mono text-subtle">{model.name}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap tabular-nums">{model.stats.commits} commits</span>
            <span aria-hidden="true" className="max-sm:hidden">·</span>
            <span className="whitespace-nowrap tabular-nums max-sm:hidden">
              {model.authorCount} {model.authorCount === 1 ? 'author' : 'authors'}
            </span>
          </div>
        )}
        <div className="max-sm:order-1 max-sm:ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
