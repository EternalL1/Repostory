// Numbers for the Story: a tap-through recap of a repository, built from the same model as every other tab.
import { formatDate, timeParts } from './git.js'
import { dayName, dayStats, teamStats } from './team.js'

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS_LONG = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
const DAY_MS = 86_400_000

// Words that open a commit subject but say nothing about the work
const SKIP_WORDS = new Set(['merge', 'revert', 'wip', 'the', 'a', 'an', 'and', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'it', 'this', 'that'])
// Conventional-commit types read as verbs
const TYPE_WORD = { feat: 'feat', fix: 'fix', chore: 'chore', docs: 'docs', refactor: 'refactor', test: 'test', style: 'style', perf: 'perf', build: 'build', ci: 'ci' }

/** The opening word of a subject ("Fix login" -> "fix", "feat(ui): add" -> "feat"), or '' for merges and noise. */
export function leadWord(subject) {
  const s = subject.trim()
  if (/^merge\b/i.test(s)) return ''
  const conv = /^([a-z]+)(?:\([^)]*\))?!?:/i.exec(s)
  if (conv && TYPE_WORD[conv[1].toLowerCase()]) return conv[1].toLowerCase()
  const w = /^[[(]?([A-Za-z][A-Za-z'-]{1,20})/.exec(s)?.[1]?.toLowerCase()
  return w && !SKIP_WORDS.has(w) ? w : ''
}

/** A one-word read on when the commits land, from the hour that sees the most of them. */
export function persona(hour) {
  if (hour >= 22 || hour < 5) return { name: 'Night Owl', line: 'The code comes out after dark.' }
  if (hour < 9) return { name: 'Early Bird', line: 'Shipped before the first stand-up.' }
  if (hour < 12) return { name: 'Morning Maker', line: 'Best work happens before lunch.' }
  if (hour < 17) return { name: 'Daytime Shipper', line: 'Right in the middle of the working day.' }
  return { name: 'Evening Hacker', line: 'One more commit before dinner.' }
}

const pad2 = (n) => String(n).padStart(2, '0')
const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayTs = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
export const shortDay = (t) => {
  const d = new Date(t)
  return `${WD_SHORT[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}

/** 0 = none, then 1–4 by quartile of the non-zero counts, so one huge day doesn't flatten the rest. */
function leveler(counts) {
  const nz = counts.filter((n) => n > 0).sort((a, b) => a - b)
  if (!nz.length) return () => 0
  const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))]
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)]
  return (n) => (n <= 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4)
}

/**
 * The contribution calendar, per calendar day in each author's own date: weeks × weekdays (Sunday on top),
 * the longest run of days with commits, and the greenest month laid out as its own small calendar.
 */
export function calendar(model) {
  const perDay = new Map()
  for (const c of model.order) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(c.date || '')) continue
    const t = dayTs(c.date)
    perDay.set(t, (perDay.get(t) || 0) + 1)
  }
  const days = [...perDay.keys()].sort((a, b) => a - b)
  if (!days.length) return null
  const first = days[0]
  const last = days[days.length - 1]
  const level = leveler([...perDay.values()])

  const start = first - new Date(first).getUTCDay() * DAY_MS
  const end = last + (6 - new Date(last).getUTCDay()) * DAY_MS
  const weeks = []
  for (let t = start; t <= end; t += 7 * DAY_MS) {
    weeks.push(
      Array.from({ length: 7 }, (_, k) => {
        const day = t + k * DAY_MS
        const n = perDay.get(day) || 0
        return { t: day, n, level: level(n), out: day < first || day > last }
      }),
    )
  }

  let streak = { len: 0, from: null, to: null }
  let runStart = null
  days.forEach((t, i) => {
    if (i === 0 || t - days[i - 1] !== DAY_MS) runStart = t
    const len = Math.round((t - runStart) / DAY_MS) + 1
    if (len > streak.len) streak = { len, from: runStart, to: t }
  })

  const perMonth = new Map()
  for (const [t, n] of perDay) {
    const d = new Date(t)
    const key = d.getUTCFullYear() * 12 + d.getUTCMonth()
    const m = perMonth.get(key) || { key, commits: 0, active: 0 }
    m.commits += n
    m.active++
    perMonth.set(key, m)
  }
  const top = [...perMonth.values()].sort((a, b) => b.commits - a.commits || b.active - a.active)[0]
  const y = Math.floor(top.key / 12)
  const mo = top.key % 12
  const monthFirst = Date.UTC(y, mo, 1)
  const length = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
  const lead = new Date(monthFirst).getUTCDay()

  return {
    weeks,
    activeDays: days.length,
    spanDays: Math.round((last - first) / DAY_MS) + 1,
    streak,
    month: {
      name: MONTHS_LONG[mo],
      year: y,
      commits: top.commits,
      active: top.active,
      length,
      cells: [
        ...Array.from({ length: lead }, () => null),
        ...Array.from({ length }, (_, i) => {
          const t = monthFirst + i * DAY_MS
          const n = perDay.get(t) || 0
          return { t, n, level: level(n), date: i + 1 }
        }),
      ],
    },
  }
}

export const fmt = (n) => n.toLocaleString('en-US')

/** Everything the Story's slides show, in one object. */
export function storyStats(model) {
  const team = teamStats(model)
  const days = dayStats(model)
  const commits = model.order.length

  const hours = Array(24).fill(0)
  const weekdays = Array(7).fill(0)
  for (const t of team.times) {
    hours[t.hour]++
    weekdays[t.day]++
  }
  const peakHour = hours.indexOf(Math.max(...hours))
  const peakWeekday = weekdays.indexOf(Math.max(...weekdays))
  const weekend = weekdays[0] + weekdays[6]

  // per month of the year, for the whole repo and per author
  const monthsOf = new Map()
  const repoMonths = Array(12).fill(0)
  const words = new Map()
  for (const c of model.order) {
    const m = /^\d{4}-(\d{2})/.exec(c.date || '')
    if (m) {
      const i = +m[1] - 1
      repoMonths[i]++
      const arr = monthsOf.get(c.author) || Array(12).fill(0)
      arr[i]++
      monthsOf.set(c.author, arr)
    }
    const w = leadWord(c.subject)
    if (w) words.set(w, (words.get(w) || 0) + 1)
  }
  const peakOf = (arr) => arr.indexOf(Math.max(...arr))

  const top = team.authors.slice(0, 5).map((a) => {
    const months = monthsOf.get(a.name) || Array(12).fill(0)
    return { ...a, share: commits ? a.commits / commits : 0, months, peakMonth: peakOf(months) }
  })

  const first = model.firstDate
  const last = model.lastDate
  const spanDays = first && last ? Math.max(1, Math.round((Date.parse(last.slice(0, 10)) - Date.parse(first.slice(0, 10))) / DAY_MS) + 1) : 1
  const sameYear = first?.slice(0, 4) === last?.slice(0, 4)
  const range = first && last ? `${formatDate(first, { year: !sameYear })} – ${formatDate(last, { year: true })}` : ''
  const year = last ? last.slice(0, 4) : ''

  const topWord = [...words.entries()].sort((a, b) => b[1] - a[1])[0] || null
  const hp = persona(peakHour)

  return {
    name: model.name,
    year,
    range,
    spanDays,
    commits,
    perDay: commits / spanDays,
    activeDays: days.activeDays,
    streak: days.streak,
    busiest: days.busiest ? { label: dayName(days.busiest.day), count: days.busiest.count } : null,
    hours,
    peakHour,
    peakHourLabel: `${pad2(peakHour)}:00`,
    peakWeekday: WEEKDAYS_LONG[peakWeekday],
    weekendShare: commits ? weekend / commits : 0,
    lateNight: team.lateNight,
    persona: hp,
    authors: team.authors.length,
    top,
    repoMonths,
    peakMonth: MONTHS_LONG[peakOf(repoMonths)],
    files: team.fileCount,
    hotspots: team.hotspots.slice(0, 5).map((f) => ({ path: f.path, changes: f.changes, authors: f.authors.length })),
    topWord: topWord ? { word: topWord[0], count: topWord[1] } : null,
    merges: model.stats.merges,
    branches: model.branches.length,
    tags: model.tags.length,
    flow: team.flows[0] || null,
    cal: calendar(model),
  }
}


