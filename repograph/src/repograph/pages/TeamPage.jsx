import { useMemo, useState } from 'react'
import { Card, SectionTitle } from '../components/ui.jsx'
import { DAYS, formatDate } from '../lib/git.js'
import { COL, LANE_COLORS, tint } from '../lib/theme.js'
import { teamStats } from '../lib/team.js'

const pad2 = (n) => String(n).padStart(2, '0')

function Kpi({ label, value, sub, total, warn = false }) {
  return (
    <Card className={warn ? 'border-branch-b/40' : ''}>
      <SectionTitle as="div">{label}</SectionTitle>
      <div className={`mt-1 text-[28px] font-semibold leading-tight tabular-nums tracking-[-0.02em] ${warn ? 'text-branch-b' : ''}`}>
        {value}
        {total != null && <span className="ml-1.5 text-sm font-normal tracking-normal text-muted">of {total}</span>}
      </div>
      <div className="text-[13px] text-soft">{sub}</div>
    </Card>
  )
}

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
  const firstName = (n) => n.split(' ')[0]

  return (
    <main className="flex flex-col gap-4 px-4 pb-10 pt-6 sm:px-8">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">Team insights</h1>
        <div className="mt-1 text-[13px] text-muted">
          {formatDate(model.firstDate)} – {formatDate(model.lastDate, { year: true })} · all branches
        </div>
      </div>

      <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Kpi
          label="Contributors"
          value={team.authors.length}
          sub={
            team.topTwo.length === 2
              ? `${firstName(team.topTwo[0].name)} and ${firstName(team.topTwo[1].name)} made ${team.topShare}% of commits`
              : 'One person made every commit'
          }
        />
        <Kpi
          label="Busiest slot"
          value={team.busiest ? `${DAYS[team.busiest.day]} ${pad2(team.busiest.hour)}:00` : '—'}
          sub={team.busiest ? `${team.busiest.count} commit${team.busiest.count === 1 ? '' : 's'} in that hour` : 'No dated commits'}
        />
        <Kpi label="Late-night commits" value={team.lateNight} total={model.stats.commits} sub="Between 10 PM and 5 AM" />
        <Kpi label="Single-owner files" value={team.singleOwner} total={team.fileCount} sub="Only one person has touched them" warn={team.singleOwner > 0} />
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-4">
        <Card className="p-5">
          <SectionTitle className="mb-3.5">Commits by author</SectionTitle>
          <div className="flex flex-col gap-3.5">
            {team.authors.map((a) => (
              <div key={a.name} className="grid grid-cols-[130px_minmax(0,1fr)_40px] items-center gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{a.name}</div>
                  <div className="text-xs text-muted">
                    {a.fileChanges} file changes · {a.merges} {a.merges === 1 ? 'merge' : 'merges'}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-panel-2">
                  <div className="h-2 rounded-full" style={{ width: `${(a.commits / maxCommits) * 100}%`, background: colorOf(a.name) }} />
                </div>
                <div className="text-right text-[13px] font-medium tabular-nums">{a.commits}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <SectionTitle>When commits happen</SectionTitle>
            <div role="group" aria-label="Filter by author" className="flex flex-wrap gap-1.5">
              {[{ name: '', label: 'All' }, ...team.authors.map((a) => ({ name: a.name, label: firstName(a.name) }))].map((p) => {
                const on = p.name === who
                const c = p.name ? colorOf(p.name) : COL.accent
                return (
                  <button
                    key={p.label + p.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWho(p.name)}
                    className="press min-h-7 cursor-pointer rounded-full border px-3 text-xs font-medium"
                    style={{ background: on ? c : 'transparent', color: on ? COL.ink : COL.subtle, borderColor: on ? c : COL.line }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[3px] text-[11px] text-muted">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={`h${h}`} className="text-center">{h % 6 === 0 ? h : ''}</span>
            ))}
            {DAYS.map((day, d) => [
              <span key={day} className="leading-[18px]">{day}</span>,
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
          <p className="mb-0 mt-3 text-xs text-muted">Times are each author's local time.</p>
        </Card>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-4">
        <Card className="p-5">
          <SectionTitle className="mb-1">Hotspots</SectionTitle>
          <p className="mb-3 mt-0 text-[13px] text-soft">Files that change most often. They tend to attract bugs and merge conflicts.</p>
          {hot.length === 0 ? (
            <p className="m-0 text-[13px] text-muted">No file data. Run the git command with --name-only to see hotspots.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="pb-2 font-normal">File</th>
                    <th className="w-[120px] pb-2 font-normal">Changes</th>
                    <th className="w-[120px] pb-2 text-right font-normal">Owners</th>
                  </tr>
                </thead>
                <tbody>
                  {hot.map((f) => {
                    const i = f.path.lastIndexOf('/')
                    const single = f.authors.length === 1
                    return (
                      <tr key={f.path} className="border-b border-line last:border-0">
                        <td className="max-w-0 truncate py-2 pr-3 font-mono text-xs" title={f.path}>
                          <span className="text-muted">{f.path.slice(0, i + 1)}</span>
                          {f.path.slice(i + 1)}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-panel-2">
                              <div className="h-1.5 rounded-full bg-branch-b" style={{ width: `${(f.changes / maxChanges) * 100}%` }} />
                            </div>
                            <span className="w-5 text-right text-xs tabular-nums">{f.changes}</span>
                          </div>
                        </td>
                        <td className={`py-2 text-right text-xs ${single ? 'text-branch-b' : 'text-soft'}`}>
                          {single ? `${firstName(f.authors[0])} only` : f.authors.map(firstName).join(', ')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle className="mb-1">How work flows between branches</SectionTitle>
          <p className="mb-4 mt-0 text-[13px] text-soft">Counted from merge commit messages.</p>
          {team.flows.length === 0 ? (
            <p className="m-0 text-[13px] text-muted">No standard merge messages found.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {team.flows.map((f) => (
                <li key={f.from + f.into} className="flex flex-wrap items-center gap-3">
                  <span className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs">{f.from}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <svg width="40" height="12" viewBox="0 0 40 12" aria-hidden="true">
                      <path d="M0 6h34M29 1.5l5 4.5-5 4.5" style={{ stroke: COL.muted }} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f.count}×
                  </span>
                  <span className="rounded-lg border border-accent/50 px-3 py-1.5 font-mono text-xs font-medium">{f.into}</span>
                </li>
              ))}
            </ul>
          )}
          {model.branches.some((b) => b.stale) && (
            <p className="mb-0 mt-4 text-[13px] text-subtle">
              Stale branches (not in HEAD, idle 14+ days):{' '}
              {model.branches.filter((b) => b.stale).map((b) => (
                <span key={b.name} className="mr-2 font-mono text-xs text-branch-b">{b.name}</span>
              ))}
            </p>
          )}
        </Card>
      </div>
    </main>
  )
}
