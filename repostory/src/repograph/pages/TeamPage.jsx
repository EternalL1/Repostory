import { useMemo, useState } from 'react'
import { DAYS, formatDate } from '../lib/git.js'
import { COL, LANE_COLORS, tint } from '../lib/theme.js'
import { teamStats } from '../lib/team.js'

const pad2 = (n) => String(n).padStart(2, '0')
const firstName = (n) => n.split(' ')[0]

function Section({ title, note, aside, children }) {
  return (
    <section className="min-w-0 border-t border-line pt-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">{title}</h2>
          {note && <p className="m-0 mt-0.5 text-sm text-soft">{note}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

const Em = ({ children, color }) => (
  <span className="font-semibold text-fg" style={color ? { color } : undefined}>
    {children}
  </span>
)

export default function TeamPage({ model }) {
  const team = useMemo(() => teamStats(model), [model])
  const [who, setWho] = useState('')

  const colorOf = useMemo(() => {
    const map = new Map(team.authors.map((a, i) => [a.name, LANE_COLORS[i % LANE_COLORS.length]]))
    return (name) => map.get(name) || LANE_COLORS[0]
  }, [team])

  const heat = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const t of team.times) if (!who || t.author === who) grid[t.day][t.hour]++
    return { grid, max: Math.max(1, ...grid.flat()) }
  }, [team, who])
  const heatColor = who ? colorOf(who) : COL.accent

  const maxCommits = team.authors[0]?.commits || 1
  const hot = team.hotspots.slice(0, 8)
  const maxChanges = hot[0]?.changes || 1
  const stale = model.branches.filter((b) => b.stale)
  const total = model.stats.commits

  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 pb-16 pt-10 sm:px-8">
      <header className="max-w-[820px]">
        <p className="m-0 mb-3 text-xs text-muted">
          {model.name} · {formatDate(model.firstDate)} – {formatDate(model.lastDate, { year: true })} · all branches
        </p>
        <h1 className="m-0 text-2xl font-semibold leading-tight">
          {team.authors.length} {team.authors.length === 1 ? 'person' : 'people'}, {total} commits.{' '}
          <span className="text-muted">
            {team.topTwo.length === 2
              ? `${firstName(team.topTwo[0].name)} and ${firstName(team.topTwo[1].name)} made ${team.topShare}% of them.`
              : 'One person made all of them.'}
          </span>
        </h1>
        <p className="m-0 mt-3 text-base leading-relaxed text-soft">
          {team.busiest && (
            <>
              The busiest hour is <Em>{DAYS[team.busiest.day]} {pad2(team.busiest.hour)}:00</Em>.{' '}
            </>
          )}
          <Em>{team.lateNight}</Em> of {total} commits landed between 10 PM and 5 AM.{' '}
          {team.fileCount > 0 && (
            <>
              <Em color={team.singleOwner ? COL.b : undefined}>{team.singleOwner} of {team.fileCount}</Em> files have only one person
              who has touched them.
            </>
          )}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-2">
        <Section title="Commits by author">
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {team.authors.map((a) => (
              <li key={a.name} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_32px] items-center gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <div className="truncate text-xs text-muted">
                    {a.fileChanges} file changes · {a.merges} {a.merges === 1 ? 'merge' : 'merges'}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-panel-2">
                  <div className="h-1.5 rounded-full" style={{ width: `${(a.commits / maxCommits) * 100}%`, background: colorOf(a.name) }} />
                </div>
                <div className="text-right text-sm font-medium tabular-nums">{a.commits}</div>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="When commits happen"
          note="Each author's local time."
          aside={
            <div role="group" aria-label="Filter by author" className="flex flex-wrap gap-1">
              {[{ name: '', label: 'Everyone' }, ...team.authors.map((a) => ({ name: a.name, label: firstName(a.name) }))].map((p) => {
                const on = p.name === who
                return (
                  <button
                    key={p.label + p.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWho(p.name)}
                    className={`press flex min-h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium ${
                      on ? 'bg-fg/[0.08] text-fg' : 'text-muted hover:bg-fg/[0.04] hover:text-subtle'
                    }`}
                  >
                    {p.name && <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: colorOf(p.name) }} />}
                    {p.label}
                  </button>
                )
              })}
            </div>
          }
        >
          <div className="grid grid-cols-[32px_repeat(24,minmax(0,1fr))] gap-[3px] text-xs text-muted">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={`h${h}`} className="text-center">{h % 6 === 0 ? h : ''}</span>
            ))}
            {DAYS.map((day, d) => [
              <span key={day} className="leading-[16px]">{day}</span>,
              ...heat.grid[d].map((v, h) => (
                <div
                  key={`${day}${h}`}
                  title={`${day} ${pad2(h)}:00 · ${v} commit${v === 1 ? '' : 's'}`}
                  className="aspect-square rounded-[3px] transition-[background-color] duration-200"
                  style={{ background: v ? tint(heatColor, Math.round(35 + (65 * v) / heat.max)) : COL.panel2 }}
                />
              )),
            ])}
          </div>
        </Section>

        <Section title="Hotspots" note="Files that change most often attract bugs and merge conflicts.">
          {hot.length === 0 ? (
            <p className="m-0 text-sm text-muted">No file data. Run the git command with --name-only to see hotspots.</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="pb-2 font-normal">File</th>
                  <th className="w-[96px] pb-2 font-normal">Changes</th>
                  <th className="w-[96px] pb-2 text-right font-normal">Owners</th>
                </tr>
              </thead>
              <tbody>
                {hot.map((f) => {
                  const i = f.path.lastIndexOf('/')
                  const single = f.authors.length === 1
                  return (
                    <tr key={f.path} className="border-t border-line">
                      <td className="truncate py-2 pr-3 font-mono text-xs" title={f.path}>
                        <span className="text-muted max-sm:hidden">{f.path.slice(0, i + 1)}</span>
                        {f.path.slice(i + 1)}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1 flex-1 rounded-full bg-panel-2">
                            <div className="h-1 rounded-full bg-soft" style={{ width: `${(f.changes / maxChanges) * 100}%` }} />
                          </div>
                          <span className="w-4 text-right text-xs tabular-nums">{f.changes}</span>
                        </div>
                      </td>
                      <td className={`truncate py-2 text-right text-xs ${single ? 'text-branch-b' : 'text-soft'}`}>
                        {single ? `${firstName(f.authors[0])} only` : f.authors.map(firstName).join(', ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="How work flows between branches" note="Counted from merge commit messages.">
          {team.flows.length === 0 ? (
            <p className="m-0 text-sm text-muted">No standard merge messages found.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {team.flows.map((f) => (
                <li key={f.from + f.into} className="flex items-center gap-3 border-t border-line py-2 font-mono text-xs first:border-0">
                  <span className="min-w-0 truncate text-subtle">{f.from}</span>
                  <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" className="flex-none">
                    <path d="M0 5h24M20 1.5l4 3.5-4 3.5" style={{ stroke: COL.muted }} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="min-w-0 truncate text-fg">{f.into}</span>
                  <span className="ml-auto flex-none font-sans tabular-nums text-muted">{f.count}×</span>
                </li>
              ))}
            </ul>
          )}
          {stale.length > 0 && (
            <p className="m-0 mt-4 text-xs text-muted">
              Stale (not in HEAD, idle 14+ days):{' '}
              {stale.map((b) => (
                <span key={b.name} className="mr-2 font-mono text-branch-b">{b.name}</span>
              ))}
            </p>
          )}
        </Section>
      </div>
    </main>
  )
}
