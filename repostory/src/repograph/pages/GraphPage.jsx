import { useMemo, useState } from 'react'
import CommitGraph from '../components/CommitGraph.jsx'
import { Badge, Button, Card, CopyButton, Dot, SectionTitle, StatTile, fieldClass } from '../components/ui.jsx'
import { ancestors, formatDate, shortHash } from '../lib/git.js'
import { COL, laneColor } from '../lib/theme.js'

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

  const go = (hash) => {
    onSelect(hash)
    setFocus({ hash })
  }

  const commit = selected ? model.commits.get(selected) : null
  const s = model.stats

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3 sm:px-8">
        <div className="relative flex-[0_1_300px] max-sm:basis-full">
          <label htmlFor="search" className="sr-only">Search commits</label>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hash, message or author"
            className={`${fieldClass} w-full pl-8`}
          />
        </div>
        <label htmlFor="branchFilter" className="sr-only">Show branch</label>
        <select id="branchFilter" value={branch} onChange={(e) => setBranch(e.target.value)} className={fieldClass}>
          <option value="">All branches</option>
          {model.branches.map((b) => (
            <option key={b.name} value={b.hash}>{b.name}</option>
          ))}
        </select>
        <div className="flex-1" />
        <Button aria-pressed={showLongest} onClick={() => setShowLongest((v) => !v)} className={showLongest ? 'border-path/60 bg-path/10 text-path hover:bg-path/15' : ''}>
          <Dot color={COL.path} />
          Longest path
        </Button>
      </div>

      <div className="flex flex-wrap items-start gap-4 px-4 pb-10 pt-4 sm:px-8">
        {/* Left sidebar */}
        <aside className="flex flex-[1_1_240px] flex-col gap-4 sm:max-w-[260px]">
          <Card>
            <SectionTitle className="mb-2.5">Branches</SectionTitle>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {model.branches.map((b) => (
                <li key={b.name}>
                  <button
                    type="button"
                    onClick={() => go(b.hash)}
                    className={`flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left transition-colors duration-150 hover:bg-panel-2 ${
                      selected === b.hash ? 'bg-panel-2' : ''
                    }`}
                  >
                    <Dot color={laneColor(b.color)} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{b.name}</span>
                    {b.head ? (
                      <Badge color={COL.accent}>HEAD</Badge>
                    ) : b.stale ? (
                      <span className="text-xs text-branch-b">stale</span>
                    ) : (
                      <span className="text-xs text-muted">{formatDate(b.date)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {model.tags.length > 0 && (
              <>
                <SectionTitle className="mb-2.5 mt-4">Tags</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {model.tags.map((t) => (
                    <button key={t.name} type="button" onClick={() => go(t.hash)} className="press cursor-pointer rounded-full">
                      <Badge color={COL.mergeBase}>{t.name}</Badge>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle className="mb-2.5">Graph stats</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <StatTile value={s.commits} label="Commits" hint="vertices" />
              <StatTile value={s.edges} label="Parent links" hint="edges child → parent" />
              <StatTile value={s.merges} label="Merges" hint="out-degree ≥ 2" />
              <StatTile value={s.branchPoints} label="Branch points" hint="in-degree ≥ 2" />
              <StatTile value={s.tips} label="Tips" hint="sources, in-degree 0" />
              <StatTile value={s.roots} label="Roots" hint="sinks, out-degree 0" />
              <StatTile value={s.longest} label="Longest path" hint="commits, root → tip" />
              <StatTile value={s.width} label="Max width" hint="parallel lanes" />
            </div>
            {showLongest && (
              <p className="mb-0 mt-3 text-xs text-muted">
                Longest chain: {s.longest} commits, from{' '}
                <button type="button" className="cursor-pointer font-mono text-accent hover:underline" onClick={() => go(model.longest.root)}>
                  {shortHash(model.longest.root)}
                </button>{' '}
                to{' '}
                <button type="button" className="cursor-pointer font-mono text-accent hover:underline" onClick={() => go(model.longest.tip)}>
                  {shortHash(model.longest.tip)}
                </button>
                . Found with dynamic programming over a topological order.
              </p>
            )}
          </Card>
        </aside>

        {/* Graph */}
        <section aria-label="Commit graph" className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-xl border border-line bg-panel">
          <div className="flex min-w-[720px] items-center gap-2.5 border-b border-line py-2 pl-4 pr-4 text-xs font-medium text-muted max-md:hidden">
            <span className="w-[120px]">Graph</span>
            <span className="w-16">Hash</span>
            <span className="flex-1">Message</span>
            <span className="w-[100px]">Author</span>
            <span className="w-[52px] text-right">Date</span>
          </div>
          <CommitGraph
            model={model}
            selected={selected}
            onSelect={onSelect}
            mode={showLongest ? 'longest' : 'normal'}
            highlight={highlight}
            focus={focus}
          />
        </section>

        {/* Inspector */}
        <aside aria-label="Selected commit" className="flex flex-[1_1_300px] flex-col gap-4 rounded-xl border border-line bg-panel p-4 sm:max-w-[340px] lg:sticky lg:top-[72px]">
          {!commit ? (
            <>
              <SectionTitle>Commit</SectionTitle>
              <p className="m-0 text-[13px] leading-relaxed text-muted">Pick a commit in the graph to see its parents, children and changed files.</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <SectionTitle>Commit</SectionTitle>
                {commit.parents.length > 1 && (
                  <Badge color="var(--color-merge)">Merge commit</Badge>
                )}
                {commit.parents.length <= 1 && commit.children.length > 1 && (
                  <Badge color={COL.path}>Branch point</Badge>
                )}
              </div>
              <div className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{commit.subject}</div>
              <dl className="m-0 grid grid-cols-[80px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
                <dt className="text-muted">Hash</dt>
                <dd className="m-0 break-all font-mono text-xs">{commit.hash}</dd>
                <dt className="text-muted">Author</dt>
                <dd className="m-0">{commit.author}</dd>
                <dt className="text-muted">Date</dt>
                <dd className="m-0">{formatDate(commit.date, { year: true, time: true })}</dd>
                <dt className="text-muted">Parents</dt>
                <dd className="m-0 flex flex-wrap gap-2">
                  {commit.parents.length ? commit.parents.map((p) => (
                    <button key={p} type="button" onClick={() => go(p)} className="cursor-pointer font-mono text-xs text-accent hover:underline">
                      {shortHash(p)}
                    </button>
                  )) : <span className="text-muted">none (root)</span>}
                </dd>
                <dt className="text-muted">Children</dt>
                <dd className="m-0 flex flex-wrap gap-2">
                  {commit.children.length ? commit.children.map((h) => (
                    <button key={h} type="button" onClick={() => go(h)} className="cursor-pointer font-mono text-xs text-accent hover:underline">
                      {shortHash(h)}
                    </button>
                  )) : <span className="text-muted">none (tip)</span>}
                </dd>
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <StatTile value={commit.parents.length} label="Parents" hint="out-degree" />
                <StatTile value={commit.children.length} label="Children" hint="in-degree" />
              </div>
              {commit.files.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs text-muted">Files changed ({commit.files.length})</div>
                  <ul className="m-0 flex max-h-48 list-none flex-col gap-1 overflow-auto rounded-lg border border-line bg-ink p-2.5 font-mono text-xs text-subtle">
                    {commit.files.map((f) => <li key={f} className="break-all">{f}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="a" onClick={() => onSetCompare('a', commit.hash)}>Set as A</Button>
                <Button variant="b" onClick={() => onSetCompare('b', commit.hash)}>Set as B</Button>
                <CopyButton text={commit.hash} className="min-h-9 px-3 text-[13px]">Copy hash</CopyButton>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  )
}
