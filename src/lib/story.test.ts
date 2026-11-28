import { describe, expect, it } from 'vitest'
import { buildModel, type Model } from './git'
import { SAMPLES } from './samples'
import { onlyAuthors } from './git'
import { dayStats } from './team'
import { BUSIEST_PEOPLE, calendar, clock12, clock12Of, calendarFrom, calendarLayout, dailyCounts, fileLabels, fromSnapshot, MONTHS, isSolo, storyStats, summaryLabels, toSnapshot } from './story'

// ── the calendar exactly as it was computed before shares stored daily counts (characterization reference) ──
const DAY_MS = 86_400_000
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dayTs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))
function leveler(counts: number[]): (n: number) => number {
  const nz = counts.filter((n) => n > 0).sort((a, b) => a - b)
  if (!nz.length) return () => 0
  const q = (p: number) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))]
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)]
  return (n: number) => (n <= 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4)
}
void MONTHS
/**
 * The contribution calendar, per calendar day in each author's own date: weeks × weekdays (Sunday on top),
 * the longest run of days with commits, and the greenest month laid out as its own small calendar.
 */
type Streak = { len: number; from: number | null; to: number | null }
type CalendarCell = { t: number; n: number; level: number; out: boolean }
type MonthCell = { t: number; n: number; level: number; date: number }

function legacyCalendar(model: Model) {
  const perDay = new Map<number, number>()
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
  const weeks: CalendarCell[][] = []
  for (let t = start; t <= end; t += 7 * DAY_MS) {
    weeks.push(
      Array.from({ length: 7 }, (_, k) => {
        const day = t + k * DAY_MS
        const n = perDay.get(day) || 0
        return { t: day, n, level: level(n), out: day < first || day > last }
      }),
    )
  }

  let streak: Streak = { len: 0, from: null, to: null }
  let runStart = 0
  days.forEach((t, i) => {
    if (i === 0 || t - days[i - 1] !== DAY_MS) runStart = t
    const len = Math.round((t - runStart) / DAY_MS) + 1
    if (len > streak.len) streak = { len, from: runStart, to: t }
  })

  const perMonth = new Map<number, { key: number; commits: number; active: number }>()
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
        ...Array.from({ length: lead }, (): MonthCell | null => null),
        ...Array.from({ length }, (_, i): MonthCell => {
          const t = monthFirst + i * DAY_MS
          const n = perDay.get(t) || 0
          return { t, n, level: level(n), date: i + 1 }
        }),
      ],
    },
  }
}


// a linear history with a commit on most days, `years` long, ending 2026-11-26
function longRepo(years: number): Model {
  const end = Date.UTC(2026, 10, 26)
  let seed = 7
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  const rows: string[] = []
  let prev = ''
  for (let d = Math.round(years * 365.25); d >= 0; d--) {
    if (rnd() > 0.6) continue
    const iso = new Date(end - d * DAY_MS + 10 * 3_600_000).toISOString().slice(0, 19) + '+00:00'
    for (let k = 0; k < 1 + Math.floor(rnd() * 4); k++) {
      rows.push(`@@c${d}-${k}|${prev}|Dev ${d % 5}|${iso}||Fix ${d}\nsrc/f${d % 40}.ts`)
      prev = `c${d}-${k}`
    }
  }
  return buildModel(rows.reverse().join('\n'), `${years}y`)
}

const models: [string, Model][] = [
  ...SAMPLES.map((s): [string, Model] => [s.name, buildModel(s.text(), s.name)]),
  ['15 years', longRepo(15)],
  ['30 years', longRepo(30)],
]

describe('calendar from daily counts', () => {
  it.each(models)('rebuilds exactly the calendar computed before (%s)', (_, model) => {
    expect(calendar(model)).toEqual(legacyCalendar(model))
  })

  it('stores one count per day from the first commit day to the last', () => {
    const daily = dailyCounts(models[0][1])!
    expect(daily.start % DAY_MS).toBe(0)
    expect(daily.counts.reduce((a, b) => a + b, 0)).toBe(models[0][1].order.length)
    expect(daily.counts[0]).toBeGreaterThan(0)
    expect(daily.counts.at(-1)).toBeGreaterThan(0)
  })

  it('has no calendar without dated commits', () => {
    expect(calendarFrom(null)).toBeNull()
    expect(calendarFrom({ start: 0, counts: [0, 0] })).toBeNull()
  })

  it.each(models)('round-trips a Story through its share snapshot (%s)', (_, model) => {
    const stats = storyStats(model)
    const shared = JSON.parse(JSON.stringify(toSnapshot(stats)))
    expect(shared).not.toHaveProperty('cal')
    expect(fromSnapshot(shared)).toEqual(JSON.parse(JSON.stringify(stats)))
  })
})

describe('calendarLayout', () => {
  const layoutOf = (m: Model) => calendarLayout(calendar(m)!)
  it('shows a month page for a few weeks, keeps the original strip up to a year, scrolls the strip up to 3 years, and folds longer histories into rows', () => {
    expect(layoutOf(models.find(([n]) => n === 'acme-storefront')![1])).toBe('fit')
    expect(layoutOf(longRepo(0.05))).toBe('month')
    expect(layoutOf(longRepo(1))).toBe('fit')
    expect(layoutOf(longRepo(2))).toBe('strip')
    expect(layoutOf(longRepo(3))).toBe('strip')
    expect(layoutOf(longRepo(3.2))).toBe('rows')
    expect(layoutOf(longRepo(15))).toBe('rows')
  })
})

describe('fileLabels', () => {
  it('uses file names, adding folders only to tell apart files of the same name', () => {
    expect(fileLabels(['README.md', 'src/pages/TeamPage.jsx', 'repostory/README.md'])).toEqual(['README.md', 'TeamPage.jsx', 'repostory/README.md'])
    expect(fileLabels(['a/x/index.ts', 'b/x/index.ts', 'c/y.ts'])).toEqual(['a/x/index.ts', 'b/x/index.ts', 'y.ts'])
    expect(fileLabels([])).toEqual([])
  })
})

describe('the biggest day', () => {
  const model = () => {
    const s = SAMPLES.find((x) => x.id === 'storefront')!
    return buildModel(s.text(), s.name)
  }

  it('names who committed that day, most commits first, and its first and last commit times', () => {
    const m = model()
    const b = storyStats(m).busiest!
    const iso = new Date(dayStats(m).busiest!.day).toISOString().slice(0, 10)
    const that = m.order.filter((c) => c.date.startsWith(iso))
    expect(that).toHaveLength(b.count)
    expect(b.people!.reduce((n, p) => n + p.commits, 0)).toBe(b.count)
    expect(b.crew).toBe(new Set(that.map((c) => c.author)).size)
    expect(b.people!.map((p) => p.commits)).toEqual([...b.people!.map((p) => p.commits)].sort((x, y) => y - x))
    const times = that.map((c) => c.date.slice(11, 16)).sort()
    expect([b.first, b.last]).toEqual([times[0], times.at(-1)])
  })

  it('has one person on it in a Story about one person', () => {
    const b = storyStats(onlyAuthors(model(), new Set(['Priya Nair']))).busiest!
    expect(b.crew).toBe(1)
    expect(b.people).toEqual([{ name: 'Priya Nair', commits: b.count }])
  })

  it(`names at most ${BUSIEST_PEOPLE} people and still counts everyone`, () => {
    for (const s of SAMPLES) {
      const b = storyStats(buildModel(s.text(), s.name)).busiest
      if (b) expect(b.people!.length).toBe(Math.min(b.crew!, BUSIEST_PEOPLE))
    }
  })
})

describe('a Story about one person', () => {
  it('speaks to them when everyone else is left out, and to the team otherwise', () => {
    const sample = SAMPLES.find((x) => x.id === 'storefront')!
    const team = storyStats(buildModel(sample.text(), sample.name))
    const one = storyStats(onlyAuthors(buildModel(sample.text(), sample.name), new Set(['Priya Nair'])))
    expect([isSolo(team), isSolo(one)]).toEqual([false, true])
    expect(summaryLabels(team)).toEqual({ people: 'Top contributors' })
    expect(summaryLabels(one)).toEqual({ people: 'Made by' })
  })
})

describe('clock12', () => {
  it('reads the 12-hour clock, with noon and midnight as 12', () => {
    expect([0, 1, 11, 12, 13, 23].map((h) => clock12(h))).toEqual(['12 AM', '1 AM', '11 AM', '12 PM', '1 PM', '11 PM'])
    expect(clock12(9, 5)).toBe('9:05 AM')
    expect(clock12Of('20:31')).toBe('8:31 PM')
    expect(clock12Of('00:07')).toBe('12:07 AM')
  })
})
