import { useEffect, useMemo, useState } from 'react'
import CommitGraph, { graphWidth } from '../components/CommitGraph'
import { Button, CopyButton, Dot, HoverCard, Kbd, fieldClass } from '../components/ui'
import { ancestors, formatDate, shortHash } from '../lib/git'
import { PixelPointer } from '../components/pixel'
import { COL, laneColor } from '../lib/theme'

const isTyping = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

function RailItem({ active, onClick, mark, children, aside }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-8 w-full cursor-pointer items-center gap-2.5 px-4 text-left transition-colors duration-150 ${
          active ? 'bg-fg/[0.06] text-fg' : 'text-subtle hover:bg-fg/[0.04] hover:text-fg'
        }`}
      >
        {mark}
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{children}</span>
        {aside}
      </button>
    </li>
  )
}

const laneMark = (color) => <span aria-hidden="true" className="h-3.5 w-[3px] flex-none rounded-full" style={{ background: color }} />

function HashLinks({ hashes, empty, onGo }) {
  if (!hashes.length) return <span className="text-muted">{empty}</span>
  return (
    <span className="flex flex-wrap gap-x-2.5 gap-y-1">
      {hashes.map((h) => (
        <button key={h} type="button" onClick={() => onGo(h)} className="cursor-pointer font-mono text-xs text-accent hover:underline">
          {shortHash(h)}
        </button>
      ))}
    </span>
  )
}

function Inspector({ model, commit, onGo, onSetCompare }) {
  if (!commit) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <PixelPointer />
        <p className="m-0 text-sm text-muted">Pick a commit to see its parents, children and changed files.</p>
        <p className="m-0 flex items-center gap-1.5 text-xs text-muted">
          <Kbd>j</Kbd>
          <Kbd>k</Kbd>
          to move
        </p>
      </div>
    )
  }
  const kind = commit.parents.length > 1 ? 'Merge commit' : commit.children.length > 1 ? 'Branch point' : !commit.parents.length ? 'Root commit' : 'Commit'
  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
          <Dot color={laneColor(commit.lane)} />
          {kind}
          <span aria-hidden="true">·</span>
          <span className="font-mono">{shortHash(commit.hash)}</span>
        </div>
        <h2 className="m-0 text-base font-semibold leading-snug">{commit.subject}</h2>
        {commit.refs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2.5">
            {commit.refs.map((r) => (
              <span key={r.type + r.name} className="font-mono text-xs" style={{ color: r.type === 'tag' ? COL.mergeBase : r.type === 'remote' ? COL.muted : laneColor(commit.lane) }}>
                {r.head ? `HEAD → ${r.name}` : r.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <dl className="m-0 grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">Author</dt>
        <dd className="m-0">{commit.author}</dd>
        <dt className="text-muted">Date</dt>
        <dd className="m-0">{formatDate(commit.date, { year: true, time: true })}</dd>
        <dt className="text-muted">Parents</dt>
        <dd className="m-0"><HashLinks hashes={commit.parents} empty="none (root)" onGo={onGo} /></dd>
        <dt className="text-muted">Children</dt>
        <dd className="m-0"><HashLinks hashes={commit.children} empty="none (tip)" onGo={onGo} /></dd>
        <dt className="text-muted">Hash</dt>
        <dd className="m-0 break-all font-mono text-xs leading-5 text-soft">{commit.hash}</dd>
      </dl>

      {commit.files.length > 0 && (
        <div>
          <h3 className="m-0 mb-2 text-xs font-medium text-muted">
            {commit.files.length} {commit.files.length === 1 ? 'file' : 'files'} changed
          </h3>
          <ul className="m-0 flex max-h-56 list-none flex-col overflow-auto p-0 font-mono text-xs">
            {commit.files.map((f) => {
              const i = f.lastIndexOf('/')
              return (
                <li key={f} className="truncate border-t border-line py-1.5 first:border-0" title={f}>
                  <span className="text-muted">{f.slice(0, i + 1)}</span>
                  <span className="text-subtle">{f.slice(i + 1)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button onClick={() => onSetCompare('a', commit.hash)}>
          <Dot color={COL.a} />
          Compare as A
        </Button>
        <Button onClick={() => onSetCompare('b', commit.hash)}>
          <Dot color={COL.b} />
          as B
        </Button>
        <CopyButton text={commit.hash} label="Copy full hash" />
      </div>
      <p className="m-0 hidden text-xs text-muted lg:block">
        <Kbd>j</Kbd> <Kbd>k</Kbd> next / previous · <Kbd>esc</Kbd> clear
      </p>
      {model.longest.set.has(commit.hash) && <p className="m-0 -mt-3 text-xs text-path">On the longest path.</p>}
    </div>
  )
}

export default function GraphPage({ model, selected, onSelect, onSetCompare }) {
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState('')
  const [showLongest, setShowLongest] = useState(false)
  const [focus, setFocus] = useState(null)

  const highlight = useMemo(() => {
    let set = null
    if (branch) set = ancestors(model.commits, branch)
    const q = query.trim().toLowerCase()
    if (q) {
      const matches = new Set(
        model.order
          .filter((c) => c.hash.startsWith(q) || c.subject.toLowerCase().includes(q) || c.author.toLowerCase().includes(q))
          .map((c) => c.hash),
      )
      set = set ? new Set([...set].filter((h) => matches.has(h))) : matches
    }
    return set
  }, [model, branch, query])

  const go = (hash, instant = false) => {
    onSelect(hash)
    setFocus({ hash, instant })
  }

  // j / k (and arrows) walk the history; Escape clears. Instant, never animated.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const down = e.key === 'j' || e.key === 'ArrowDown'
      const up = e.key === 'k' || e.key === 'ArrowUp'
      if (e.key === 'Escape') return onSelect(null)
      if (!down && !up) return
      e.preventDefault()
      const visible = highlight ? model.order.filter((c) => highlight.has(c.hash)) : model.order
      if (!visible.length) return
      const i = visible.findIndex((c) => c.hash === selected)
      const next = i < 0 ? 0 : Math.min(visible.length - 1, Math.max(0, i + (down ? 1 : -1)))
      onSelect(visible[next].hash)
      setFocus({ hash: visible[next].hash, instant: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [model, highlight, selected, onSelect])

  const commit = selected ? model.commits.get(selected) : null
  const s = model.stats
  const matchCount = highlight ? highlight.size : null

  const statRows = [
    [s.commits, 'Commits', 'Vertices of the graph'],
    [s.edges, 'Parent links', 'Edges, child → parent'],
    [s.merges, 'Merges', 'Commits with 2+ parents'],
    [s.branchPoints, 'Branch points', 'Commits with 2+ children'],
    [s.tips, 'Tips', 'Commits nothing builds on'],
    [s.roots, 'Roots', 'Commits with no parent'],
    [s.longest, 'Longest path', 'Commits on the longest root → tip chain'],
    [s.width, 'Lanes', 'Most branches open side by side'],
  ]

  return (
    <div className="lg:grid lg:h-[calc(100dvh-var(--header-h,53px))] lg:grid-cols-[232px_minmax(0,1fr)_340px]">
      {/* Branch rail */}
      <aside aria-label="Branches and tags" className="hidden flex-col overflow-y-auto border-r border-line py-4 lg:flex">
        <h2 className="m-0 mb-1 px-4 text-xs font-medium text-muted">Branches</h2>
        <ul className="m-0 list-none p-0">
          {model.branches.map((b) => (
            <RailItem
              key={b.name}
              active={selected === b.hash}
              onClick={() => go(b.hash)}
              mark={laneMark(laneColor(b.color))}
              aside={
                b.head ? (
                  <span className="text-xs font-medium text-accent">HEAD</span>
                ) : b.stale ? (
                  <span className="text-xs text-branch-b">stale</span>
                ) : (
                  <span className="text-xs text-muted">{formatDate(b.date)}</span>
                )
              }
            >
              {b.name}
            </RailItem>
          ))}
        </ul>
        {model.tags.length > 0 && (
          <>
            <h2 className="m-0 mb-1 mt-5 px-4 text-xs font-medium text-muted">Tags</h2>
            <ul className="m-0 list-none p-0">
              {model.tags.map((t) => (
                <RailItem key={t.name} active={selected === t.hash} onClick={() => go(t.hash)} mark={laneMark(COL.mergeBase)}>
                  {t.name}
                </RailItem>
              ))}
            </ul>
          </>
        )}
        {showLongest && (
          <p className="mx-4 mb-0 mt-auto pt-6 text-xs leading-relaxed text-muted">
            Longest chain: <span className="text-path">{s.longest} commits</span>, from{' '}
            <button type="button" className="cursor-pointer font-mono text-accent hover:underline" onClick={() => go(model.longest.root)}>
              {shortHash(model.longest.root)}
            </button>{' '}
            to{' '}
            <button type="button" className="cursor-pointer font-mono text-accent hover:underline" onClick={() => go(model.longest.tip)}>
              {shortHash(model.longest.tip)}
            </button>
            .
          </p>
        )}
      </aside>

      {/* Graph */}
      <section aria-label="Commit graph" className="flex min-w-0 flex-col bg-panel lg:min-h-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
          <div className="relative flex-[0_1_240px] max-sm:basis-full">
            <label htmlFor="search" className="sr-only">Search commits</label>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              id="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
              placeholder="Search commits"
              className={`${fieldClass} w-full bg-ink pl-8`}
            />
          </div>
          <label htmlFor="branchFilter" className="sr-only">Show branch</label>
          <select id="branchFilter" value={branch} onChange={(e) => setBranch(e.target.value)} className={`${fieldClass} max-w-[180px] bg-ink`}>
            <option value="">All branches</option>
            {model.branches.map((b) => (
              <option key={b.name} value={b.hash}>{b.name}</option>
            ))}
          </select>
          <Button
            variant="ghost"
            aria-pressed={showLongest}
            onClick={() => setShowLongest((v) => !v)}
            className={showLongest ? 'bg-path/10 text-path hover:bg-path/15 hover:text-path' : ''}
          >
            <Dot color={COL.path} />
            Longest path
          </Button>
          {matchCount != null && <span className="text-xs tabular-nums text-muted">{matchCount} shown</span>}
          <HoverCard
            className="ml-auto max-md:hidden"
            trigger={
              <button type="button" className="flex min-h-8 cursor-default items-center gap-1.5 rounded-lg px-2 text-xs tabular-nums text-muted hover:text-subtle">
                {s.commits} commits · {s.merges} merges
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 8h.01" />
                </svg>
              </button>
            }
          >
            <dl className="m-0 grid grid-cols-[36px_minmax(0,1fr)] gap-x-3 gap-y-2">
              {statRows.map(([v, label, hint]) => (
                <div key={label} className="contents">
                  <dt className="text-right text-sm font-semibold tabular-nums text-fg">{v}</dt>
                  <dd className="m-0">
                    <div className="text-sm text-fg">{label}</div>
                    <div className="text-xs text-muted">{hint}</div>
                  </dd>
                </div>
              ))}
            </dl>
          </HoverCard>
        </div>

        <div className="overflow-auto lg:min-h-0 lg:flex-1">
          <div
            className="sticky top-0 z-[2] flex h-8 min-w-[640px] items-center gap-3 border-b border-line bg-panel/90 pr-4 text-xs text-muted backdrop-blur max-md:hidden"
            style={{ paddingLeft: graphWidth(model) }}
          >
            <span className="w-[60px]">Hash</span>
            <span className="flex-1">Message</span>
            <span className="w-[104px]">Author</span>
            <span className="w-[48px] text-right">Date</span>
          </div>
          <CommitGraph
            model={model}
            selected={selected}
            onSelect={onSelect}
            mode={showLongest ? 'longest' : 'normal'}
            highlight={highlight}
            focus={focus}
          />
        </div>
      </section>

      {/* Inspector */}
      <aside aria-label="Selected commit" className="border-t border-line lg:overflow-y-auto lg:border-l lg:border-t-0">
        <Inspector model={model} commit={commit} onGo={(h) => go(h)} onSetCompare={onSetCompare} />
      </aside>
    </div>
  )
}
