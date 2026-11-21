export const TABS = [
  { id: 'load', label: 'Load repo' },
  { id: 'graph', label: 'Graph' },
  { id: 'compare', label: 'Compare' },
  { id: 'team', label: 'Team' },
]

export function Logo({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <path d="M5 3v16M5 8c0 4 12 2 12 7" stroke="#7c9cff" strokeWidth="2" fill="none" />
      <circle cx="5" cy="4" r="2.6" fill="#7c9cff" />
      <circle cx="5" cy="18" r="2.6" fill="#3ddc97" />
      <circle cx="17" cy="16" r="2.6" fill="#ff7eb6" />
    </svg>
  )
}

export default function Header({ tab, onTab, model }) {
  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-6 border-b border-line bg-panel px-8 py-3.5">
      <div className="flex items-center gap-2.5 font-display text-lg font-bold">
        <Logo />
        RepoGraph
      </div>
      <nav aria-label="Main" className="flex flex-wrap gap-1">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onTab(t.id)}
              className={`cursor-pointer rounded-lg border px-3.5 py-2 font-medium transition ${
                active ? 'border-line bg-panel-2 text-fg' : 'border-transparent text-muted hover:text-fg'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>
      {model && (
        <div className="ml-auto text-[13px] text-muted">
          <span className="font-mono text-fg">{model.name}</span> · {model.stats.commits} commits · {model.authorCount}{' '}
          {model.authorCount === 1 ? 'author' : 'authors'}
        </div>
      )}
    </header>
  )
}
