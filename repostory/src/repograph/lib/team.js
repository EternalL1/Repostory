import { timeParts } from './git.js'

const MERGE_BRANCH = /^Merge (?:remote-tracking )?branch '([^']+)'(?: of \S+)?(?: into (\S+))?/
const MERGE_PR = /^Merge pull request #\d+ from (\S+)/

/** Team-level stats for the Team view. */
export function teamStats(model) {
  const byAuthor = new Map()
  const times = []
  const files = new Map()
  const flows = new Map()

  for (const c of model.order) {
    const a = byAuthor.get(c.author) || { name: c.author, commits: 0, fileChanges: 0, merges: 0 }
    a.commits++
    a.fileChanges += c.files.length
    if (c.parents.length > 1) a.merges++
    byAuthor.set(c.author, a)

    const t = timeParts(c.date)
    if (t) times.push({ ...t, author: c.author })

    for (const f of c.files) {
      const e = files.get(f) || { path: f, changes: 0, authors: new Set() }
      e.changes++
      e.authors.add(c.author)
      files.set(f, e)
    }

    if (c.parents.length > 1) {
      let m = MERGE_BRANCH.exec(c.subject)
      let from = m?.[1]
      let into = m?.[2]
      if (!m && (m = MERGE_PR.exec(c.subject))) from = m[1]
      if (from) {
        into = into || 'main'
        const key = `${from}\u0000${into}`
        flows.set(key, { from, into, count: (flows.get(key)?.count || 0) + 1 })
      }
    }
  }

  const authors = [...byAuthor.values()].sort((x, y) => y.commits - x.commits)
  const hotspots = [...files.values()]
    .sort((x, y) => y.changes - x.changes)
    .map((f) => ({ ...f, authors: [...f.authors] }))

  // busiest weekday/hour slot
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const t of times) grid[t.day][t.hour]++
  let busiest = null
  grid.forEach((row, day) => row.forEach((n, hour) => {
    if (n && (!busiest || n > busiest.count)) busiest = { day, hour, count: n }
  }))

  const lateNight = times.filter((t) => t.hour >= 22 || t.hour < 5).length
  const total = model.order.length
  const topTwo = authors.slice(0, 2)
  const topShare = total ? Math.round((topTwo.reduce((s, a) => s + a.commits, 0) / total) * 100) : 0

  return {
    authors,
    times,
    hotspots,
    fileCount: hotspots.length,
    singleOwner: hotspots.filter((f) => f.authors.length === 1).length,
    busiest,
    lateNight,
    topTwo,
    topShare,
    flows: [...flows.values()].sort((x, y) => y.count - x.count),
  }
}
