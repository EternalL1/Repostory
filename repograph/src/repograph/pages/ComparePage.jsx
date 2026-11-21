import { useMemo } from 'react'
import CommitGraph from '../components/CommitGraph.jsx'
import { Card, Dot, Select } from '../components/ui.jsx'
import { compareCommits, formatDate, labelFor, refOptions, shortHash } from '../lib/git.js'
import { COL } from '../lib/theme.js'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function CommitList({ title, color, commits }) {
  return (
    <Card>
      <h2 className="m-0 mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
        <Dot color={color} />
        {title} ({commits.length})
      </h2>
      {commits.length === 0 && <p className="m-0 border-t border-line pt-2 text-[13px] text-muted">Nothing here.</p>}
      <ul className="m-0 max-h-72 list-none overflow-auto p-0">
        {commits.map((c) => (
          <li key={c.hash} className="flex gap-2.5 border-t border-line py-2">
            <span className="font-mono text-xs" style={{ color }}>{shortHash(c.hash)}</span>
            <span className="min-w-0 flex-1 truncate">{c.subject}</span>
            <span className="text-xs text-muted">{c.author.split(' ')[0]}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function ComparePage({ model, comparison: pick, onChange }) {
  const options = useMemo(() => refOptions(model, [pick.a, pick.b]).map((o) => ({ value: o.hash, label: o.label })), [model, pick.a, pick.b])
  const result = useMemo(() => compareCommits(model, pick.a, pick.b), [model, pick.a, pick.b])

  const nameA = labelFor(model, pick.a)
  const nameB = labelFor(model, pick.b)
  const base = result.mergeBases[0] ? model.commits.get(result.mergeBases[0]) : null

  const status = {
    same: { title: 'Same commit', text: 'A and B point to the same commit.' },
    'a-contains-b': { title: 'Fast-forward', text: `${nameB} is behind ${nameA}; it can fast-forward with no merge commit.` },
    'b-contains-a': { title: 'Fast-forward', text: `${nameA} is behind ${nameB}; it can fast-forward with no merge commit.` },
    diverged: { title: 'Diverged', text: 'Merging needs a merge commit or a rebase. No fast-forward.' },
  }[result.relation]

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-8 py-[18px]">
        <Select
          id="branchA"
          label="Branch A"
          labelExtra={<Dot color={COL.a} />}
          value={pick.a}
          onChange={(a) => onChange({ ...pick, a })}
          options={options}
          className="min-w-[220px] border-branch-a"
        />
        <button
          type="button"
          aria-label="Swap A and B"
          onClick={() => onChange({ a: pick.b, b: pick.a })}
          className="grid size-11 cursor-pointer place-items-center rounded-lg border border-line bg-panel text-subtle"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 7h13l-4-4M17 17H4l4 4" />
          </svg>
        </button>
        <Select
          id="branchB"
          label="Branch B"
          labelExtra={<Dot color={COL.b} />}
          value={pick.b}
          onChange={(b) => onChange({ ...pick, b })}
          options={options}
          className="min-w-[220px] border-branch-b"
        />
      </div>

      <div className="flex flex-col gap-5 px-8 pb-8 pt-5">
        <section aria-label="Comparison summary" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <Card className="border-merge-base">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Merge-base</div>
            {base ? (
              <>
                <div className="mt-1 font-mono text-[22px] font-medium text-merge-base">{shortHash(base.hash)}</div>
                <div className="truncate text-[13px] text-subtle">{base.subject}</div>
                <div className="mt-0.5 text-xs text-muted">{formatDate(base.date)} · {base.author}</div>
              </>
            ) : (
              <div className="mt-1 text-[15px] font-semibold">None (unrelated histories)</div>
            )}
          </Card>
          <Card>
            <div className="truncate text-xs font-semibold uppercase tracking-[0.06em] text-muted">{nameA} is ahead by</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-[34px] font-bold text-branch-a">{result.aOnly.length}</span>
              <span className="text-subtle">{result.aOnly.length === 1 ? 'commit' : 'commits'}</span>
            </div>
          </Card>
          <Card>
            <div className="truncate text-xs font-semibold uppercase tracking-[0.06em] text-muted">{nameB} is ahead by</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-[34px] font-bold text-branch-b">{result.bOnly.length}</span>
              <span className="text-subtle">{result.bOnly.length === 1 ? 'commit' : 'commits'}</span>
            </div>
          </Card>
          <Card>
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Status</div>
            <div className="mt-1 text-xl font-bold">{status.title}</div>
            <div className="text-[13px] text-subtle">{status.text}</div>
          </Card>
        </section>

        <div className="flex flex-wrap items-start gap-5">
          <section aria-label="Commit graph with comparison" className="min-w-0 flex-[999_1_600px] overflow-hidden rounded-xl border border-line bg-panel">
            <div className="flex flex-wrap items-center gap-4 border-b border-line px-4 py-2.5 text-xs text-subtle">
              <span className="flex items-center gap-1.5"><Dot color={COL.a} />only in A</span>
              <span className="flex items-center gap-1.5"><Dot color={COL.b} />only in B</span>
              <span className="flex items-center gap-1.5"><Dot color={COL.shared} />shared history</span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border-[1.5px] border-dashed border-merge-base" />merge-base
              </span>
              <span className="text-muted">faded = not reachable from A or B</span>
            </div>
            <CommitGraph model={model} mode="compare" comparison={result} focus={base ? { hash: base.hash } : null} />
          </section>

          <aside className="flex max-w-[380px] flex-[1_1_320px] flex-col gap-4">
            <CommitList title={`Only in ${nameA}`} color={COL.a} commits={result.aOnly} />
            <CommitList title={`Only in ${nameB}`} color={COL.b} commits={result.bOnly} />
            {result.relation === 'diverged' && (
              <Card>
                <h2 className="m-0 mb-2 text-[13px] font-semibold">Next step options (on {nameB})</h2>
                <div className="flex flex-col gap-2.5 text-[13px] text-subtle">
                  <div>
                    <code className="rounded border border-line bg-ink px-1.5 py-px font-mono text-xs text-fg">git merge {nameA}</code>
                    <div className="mt-1">Creates 1 merge commit with two parents.</div>
                  </div>
                  <div>
                    <code className="rounded border border-line bg-ink px-1.5 py-px font-mono text-xs text-fg">git rebase {nameA}</code>
                    <div className="mt-1">Replays {plural(result.bOnly.length, 'commit')} on top of {nameA} for a straight line.</div>
                  </div>
                </div>
              </Card>
            )}
            <section className="rounded-xl border border-dashed border-[#3a4556] bg-panel-2 p-4">
              <h2 className="m-0 mb-1.5 text-[13px] font-semibold text-merge-base">Graph theory: lowest common ancestor</h2>
              <p className="m-0 text-[13px] text-subtle">
                The merge-base is a commit both branches can reach by following parent links, with no other shared commit closer to
                them. Git uses it as the starting point for a three-way merge.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </>
  )
}
