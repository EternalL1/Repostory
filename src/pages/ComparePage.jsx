import { useMemo } from 'react'
import CommitGraph from '../components/CommitGraph.jsx'
import { Dot, fieldClass } from '../components/ui.jsx'
import { compareCommits, formatDate, labelFor, refOptions, shortHash } from '../lib/git.js'
import { COL } from '../lib/theme.js'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function Side({ id, label, color, value, options, onChange }) {
  return (
    <span className="relative inline-flex items-center">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Dot color={color} className="pointer-events-none absolute left-2.5" />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} max-w-[240px] pl-6 font-mono text-xs`}
        style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
      >
        {options.map((o) => (
          <option key={o.label} value={o.value}>{o.label}</option>
        ))}
      </select>
    </span>
  )
}

function CommitList({ title, color, commits, empty }) {
  return (
    <section className="border-b border-line px-5 py-4">
      <h2 className="m-0 mb-2 flex items-center gap-2 text-sm font-semibold">
        <Dot color={color} />
        <span className="min-w-0 truncate">{title}</span>
        <span className="ml-auto text-xs font-normal tabular-nums text-muted">{commits.length}</span>
      </h2>
      {commits.length === 0 ? (
        <p className="m-0 text-xs text-muted">{empty}</p>
      ) : (
        <ul className="m-0 max-h-60 list-none overflow-auto p-0">
          {commits.map((c) => (
            <li key={c.hash} className="flex items-baseline gap-2.5 py-1">
              <span className="font-mono text-xs" style={{ color }}>{shortHash(c.hash)}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{c.subject}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function ComparePage({ model, comparison: pick, onChange }) {
  const options = useMemo(() => refOptions(model, [pick.a, pick.b]).map((o) => ({ value: o.hash, label: o.label })), [model, pick.a, pick.b])
  const result = useMemo(() => compareCommits(model, pick.a, pick.b), [model, pick.a, pick.b])

  const nameA = labelFor(model, pick.a)
  const nameB = labelFor(model, pick.b)
  const base = result.mergeBases[0] ? model.commits.get(result.mergeBases[0]) : null
  const nA = result.aOnly.length
  const nB = result.bOnly.length

  const A = <span className="font-mono" style={{ color: COL.a }}>{nameA}</span>
  const B = <span className="font-mono" style={{ color: COL.b }}>{nameB}</span>

  let headline
  let detail
  if (result.relation === 'same') {
    headline = 'Same commit'
    detail = <>Both sides point at <span className="font-mono">{shortHash(pick.a)}</span>.</>
  } else if (result.relation === 'a-contains-b') {
    headline = <>{B} can fast-forward to {A}</>
    detail = <>{A} is {plural(nA, 'commit')} ahead. No merge commit needed.</>
  } else if (result.relation === 'b-contains-a') {
    headline = <>{A} can fast-forward to {B}</>
    detail = <>{B} is {plural(nB, 'commit')} ahead. No merge commit needed.</>
  } else if (base) {
    headline = <>Diverged at <span className="font-mono" style={{ color: COL.mergeBase }}>{shortHash(base.hash)}</span></>
    detail = (
      <>
        {A} has {plural(nA, 'commit')} that {B} doesn’t, and {B} has {nB}. They split after “{base.subject}” ({formatDate(base.date)}, {base.author}).
      </>
    )
  } else {
    headline = 'No shared history'
    detail = 'These commits have no common ancestor, so Git cannot find a merge-base.'
  }

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-var(--header-h,53px))]">
      <div className="flex-none border-b border-line px-4 py-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-soft">
          Compare
          <Side id="branchA" label="Branch A" color={COL.a} value={pick.a} options={options} onChange={(a) => onChange({ ...pick, a })} />
          with
          <Side id="branchB" label="Branch B" color={COL.b} value={pick.b} options={options} onChange={(b) => onChange({ ...pick, b })} />
          <button
            type="button"
            aria-label="Swap A and B"
            title="Swap"
            onClick={() => onChange({ a: pick.b, b: pick.a })}
            className="press grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-fg"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 7h13l-4-4M17 17H4l4 4" />
            </svg>
          </button>
        </div>
        <h1 className="m-0 mt-4 text-2xl font-semibold leading-tight">{headline}</h1>
        <p className="m-0 mt-1.5 max-w-[720px] text-sm leading-relaxed text-soft">{detail}</p>
      </div>

      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Commit graph with comparison" className="flex min-w-0 flex-col bg-panel lg:min-h-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2 text-xs text-muted">
            <span className="flex items-center gap-1.5"><Dot color={COL.a} />only in A</span>
            <span className="flex items-center gap-1.5"><Dot color={COL.b} />only in B</span>
            <span className="flex items-center gap-1.5"><Dot color={COL.shared} />shared</span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full border-[1.5px] border-dashed border-merge-base" />merge-base
            </span>
            <span>faded: reachable from neither</span>
          </div>
          <div className="overflow-auto lg:min-h-0 lg:flex-1">
            <CommitGraph model={model} mode="compare" comparison={result} focus={base ? { hash: base.hash } : null} />
          </div>
        </section>

        <aside className="border-t border-line lg:overflow-y-auto lg:border-l lg:border-t-0">
          <CommitList title={`Only in ${nameA}`} color={COL.a} commits={result.aOnly} empty={`Everything in ${nameA} is already in ${nameB}.`} />
          <CommitList title={`Only in ${nameB}`} color={COL.b} commits={result.bOnly} empty={`Everything in ${nameB} is already in ${nameA}.`} />
          {result.relation === 'diverged' && base && (
            <section className="border-b border-line px-5 py-4">
              <h2 className="m-0 mb-3 text-sm font-semibold">To bring {nameA} into {nameB}</h2>
              <div className="flex flex-col gap-3 text-xs text-soft">
                <div>
                  <code className="font-mono text-xs text-fg">git merge {nameA}</code>
                  <div className="mt-0.5">One merge commit with two parents.</div>
                </div>
                <div>
                  <code className="font-mono text-xs text-fg">git rebase {nameA}</code>
                  <div className="mt-0.5">Replays {plural(nB, 'commit')} on top of {nameA} for a straight line.</div>
                </div>
              </div>
            </section>
          )}
          <section className="px-5 py-4">
            <h2 className="m-0 mb-1.5 text-sm font-semibold">What a merge-base is</h2>
            <p className="m-0 text-xs leading-relaxed text-soft">
              The closest commit both sides can reach by following parent links: their lowest common ancestor. Git starts a
              three-way merge from it.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
