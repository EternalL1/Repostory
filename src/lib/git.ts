// Parses `git log` output into a commit DAG and computes layout + graph metrics.
//
// Expected input = output of GIT_LOG_COMMAND below:
//   @@<hash>|<parent hashes>|<author>|<ISO date>|<refs>|<subject>
//   <changed file>
//   <changed file>
//
// Edges point child -> parent (the way Git stores them), so:
//   out-degree = number of parents   (>= 2 means a merge commit)
//   in-degree  = number of children  (>= 2 means a branch point)

export const GIT_LOG_COMMAND = 'git log --all --pretty=format:"@@%H|%P|%an|%aI|%D|%s" --name-only'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_MS = 86_400_000

export type RefType = 'branch' | 'tag' | 'remote'
export interface Ref {
  name: string
  type: RefType
  head?: boolean
}

export interface Commit {
  hash: string
  parents: string[]
  author: string
  date: string
  ts: number
  refs: Ref[]
  subject: string
  files: string[]
  children: string[]
  /** set by layout: position in topological order, lane, and the lane each parent edge travels down */
  row: number
  lane: number
  edgeLanes: number[]
}

export type Commits = Map<string, Commit>

export interface LongestPath {
  set: Set<string>
  edges: Set<string>
  length: number
  tip: string | null
  root: string | undefined
}

export interface Branch extends Ref {
  hash: string
  color: number
  date: string
  stale: boolean
}

export interface Model {
  name: string
  commits: Commits
  order: Commit[]
  laneCount: number
  longest: LongestPath
  refs: (Ref & { hash: string })[]
  branches: Branch[]
  tags: (Ref & { hash: string })[]
  headHash: string | undefined
  authorCount: number
  firstDate: string | undefined
  lastDate: string | undefined
  stats: { commits: number; edges: number; merges: number; branchPoints: number; tips: number; roots: number; longest: number; width: number }
}

export type Relation = 'same' | 'a-contains-b' | 'b-contains-a' | 'diverged'
export interface Comparison {
  a: string
  b: string
  aSet: Set<string>
  bSet: Set<string>
  mergeBases: string[]
  aOnly: Commit[]
  bOnly: Commit[]
  relation: Relation
}

export const shortHash = (hash: string) => hash.slice(0, 7)

/** Formats an ISO date using the author's own local date/time (no timezone conversion). */
export function formatDate(iso: string | undefined, { year = false, time = false } = {}): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso || '')
  if (!m) return iso || ''
  let out = `${MONTHS[+m[2] - 1]} ${+m[3]}`
  if (year) out += `, ${m[1]}`
  if (time && m[4]) out += ` · ${m[4]}:${m[5]}`
  return out
}

/** Weekday + hour in the author's local time. */
export function timeParts(iso: string | undefined): { day: number; hour: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(iso || '')
  if (!m) return null
  return { day: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay(), hour: +m[4] }
}

export function parseRefs(raw: string): Ref[] {
  const refs: Ref[] = []
  for (let token of raw.split(',').map((t) => t.trim()).filter(Boolean)) {
    let head = false
    if (token.startsWith('HEAD -> ')) {
      head = true
      token = token.slice(8)
    }
    if (token === 'HEAD' || token.endsWith('/HEAD')) continue
    if (token.startsWith('tag: ')) refs.push({ name: token.slice(5), type: 'tag' })
    else if (/^(origin|upstream)\//.test(token)) refs.push({ name: token, type: 'remote' })
    else refs.push({ name: token, type: 'branch', head })
  }
  return refs
}

export function parseLog(text: string): Commits {
  const commits: Commits = new Map()
  let current: Commit | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('@@')) {
      const parts = line.slice(2).split('|')
      if (parts.length < 6) throw new Error(`A commit line has the wrong format:\n${line.slice(0, 120)}`)
      const [hash, parents, author, date, refs, ...subject] = parts
      current = {
        hash: hash.trim(),
        parents: parents.trim() ? parents.trim().split(/\s+/) : [],
        author: author.trim(),
        date: date.trim(),
        ts: Date.parse(date) || 0,
        refs: parseRefs(refs),
        subject: subject.join('|'),
        files: [],
        children: [],
        row: 0,
        lane: 0,
        edgeLanes: [],
      }
      commits.set(current.hash, current)
    } else if (current) {
      current.files.push(line)
    }
  }
  if (!commits.size) {
    throw new Error('No commits found. Use the exact git command shown (each commit line starts with @@).')
  }
  return commits
}

/** Children before parents; among ready commits, newest first (Kahn's algorithm). */
function topoOrder(commits: Commits): Commit[] {
  const indegree = new Map<string, number>()
  const ready: Commit[] = []
  const order: Commit[] = []
  for (const c of commits.values()) {
    indegree.set(c.hash, c.children.length)
    if (!c.children.length) ready.push(c)
  }
  while (ready.length) {
    let best = 0
    for (let i = 1; i < ready.length; i++) if (ready[i].ts > ready[best].ts) best = i
    const c = ready.splice(best, 1)[0]
    order.push(c)
    for (const p of c.parents) {
      const d = indegree.get(p)! - 1
      indegree.set(p, d)
      if (d === 0) ready.push(commits.get(p)!)
    }
  }
  return order
}

/**
 * Lane assignment, like `git log --graph`.
 * Sets c.row, c.lane and c.edgeLanes (the lane each parent edge travels down). Returns lane count.
 */
function assignLanes(order: Commit[]): number {
  const lanes: (string | null)[] = []
  let width = 1
  const freeLane = () => {
    let i = lanes.indexOf(null)
    if (i < 0) {
      i = lanes.length
      lanes.push(null)
    }
    return i
  }
  order.forEach((c, row) => {
    c.row = row
    let lane = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === c.hash) {
        if (lane < 0) lane = i
        else lanes[i] = null // other lanes waiting for this commit converge here
      }
    }
    if (lane < 0) lane = freeLane()
    c.lane = lane
    lanes[lane] = null
    c.parents.forEach((p, k) => {
      if (lanes.includes(p)) return
      if (k === 0) lanes[lane] = p
      else lanes[freeLane()] = p
    })
    c.edgeLanes = c.parents.map((p) => lanes.indexOf(p))
    width = Math.max(width, lanes.length)
  })
  return width
}

/** Longest path in a DAG: dynamic programming over the topological order (roots first). */
function longestPath(order: Commit[]): LongestPath {
  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()
  for (let i = order.length - 1; i >= 0; i--) {
    const c = order[i]
    let best = 0
    let bestParent: string | null = null
    for (const p of c.parents) {
      const d = dist.get(p) ?? 0
      if (d > best) {
        best = d
        bestParent = p
      }
    }
    dist.set(c.hash, best + 1)
    prev.set(c.hash, bestParent)
  }
  let tip: string | null = null
  let length = 0
  for (const [hash, d] of dist) {
    if (d > length) {
      length = d
      tip = hash
    }
  }
  const set = new Set<string>()
  const edges = new Set<string>()
  for (let h = tip; h; h = prev.get(h) ?? null) {
    set.add(h)
    const p = prev.get(h)
    if (p) edges.add(`${h}>${p}`)
  }
  return { set, edges, length, tip, root: [...set].pop() }
}

export function ancestors(commits: Commits, hash: string): Set<string> {
  const seen = new Set<string>()
  const stack = [hash]
  while (stack.length) {
    const h = stack.pop()!
    if (seen.has(h)) continue
    seen.add(h)
    for (const p of commits.get(h)!.parents) stack.push(p)
  }
  return seen
}

/** Merge-bases = lowest common ancestors: shared commits with no shared descendant. */
export function mergeBases(commits: Commits, aSet: Set<string>, bSet: Set<string>): string[] {
  const common = [...aSet].filter((h) => bSet.has(h))
  const below = new Set<string>()
  const stack: string[] = []
  for (const h of common) stack.push(...commits.get(h)!.parents)
  while (stack.length) {
    const h = stack.pop()!
    if (below.has(h)) continue
    below.add(h)
    stack.push(...commits.get(h)!.parents)
  }
  return common.filter((h) => !below.has(h))
}

export function buildModel(text: string, name = 'repository'): Model {
  const commits = parseLog(text)
  for (const c of commits.values()) c.parents = [...new Set(c.parents)].filter((p) => commits.has(p))
  for (const c of commits.values()) for (const p of c.parents) commits.get(p)!.children.push(c.hash)

  const order = topoOrder(commits)
  const laneCount = assignLanes(order)
  const longest = longestPath(order)

  const refs: (Ref & { hash: string })[] = []
  for (const c of order) for (const r of c.refs) refs.push({ ...r, hash: c.hash })
  const headRef = refs.find((r) => r.head)
  const headHash = headRef ? headRef.hash : order[0]?.hash
  const headAncestors = headHash ? ancestors(commits, headHash) : new Set()
  const latestTs = order.reduce((max, c) => Math.max(max, c.ts), 0)

  const branches = refs
    .filter((r) => r.type === 'branch')
    .map((r): Branch => {
      const tip = commits.get(r.hash)!
      return {
        ...r,
        color: tip.lane,
        date: tip.date,
        stale: !headAncestors.has(r.hash) && latestTs - tip.ts > 14 * DAY_MS,
      }
    })

  let edges = 0, merges = 0, branchPoints = 0, tips = 0, roots = 0
  for (const c of order) {
    edges += c.parents.length
    if (c.parents.length > 1) merges++
    if (c.children.length > 1) branchPoints++
    if (!c.children.length) tips++
    if (!c.parents.length) roots++
  }
  const dates = order.map((c) => c.date).filter(Boolean).sort()

  return {
    name,
    commits,
    order,
    laneCount,
    longest,
    refs,
    branches,
    tags: refs.filter((r) => r.type === 'tag'),
    headHash,
    authorCount: new Set(order.map((c) => c.author)).size,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    stats: { commits: order.length, edges, merges, branchPoints, tips, roots, longest: longest.length, width: laneCount },
  }
}

/** Compare two commits (usually branch tips). */
export function compareCommits(model: Model, a: string, b: string): Comparison {
  const { commits } = model
  const aSet = ancestors(commits, a)
  const bSet = ancestors(commits, b)
  const bases = mergeBases(commits, aSet, bSet)
  const byOrder = (x: string, y: string) => commits.get(x)!.row - commits.get(y)!.row
  const aOnly = [...aSet].filter((h) => !bSet.has(h)).sort(byOrder).map((h) => commits.get(h)!)
  const bOnly = [...bSet].filter((h) => !aSet.has(h)).sort(byOrder).map((h) => commits.get(h)!)
  let relation: Relation = 'diverged'
  if (a === b) relation = 'same'
  else if (aSet.has(b)) relation = 'a-contains-b'
  else if (bSet.has(a)) relation = 'b-contains-a'
  return { a, b, aSet, bSet, mergeBases: bases, aOnly, bOnly, relation }
}

/** Options for branch pickers: local branches and tags first, falling back to tips. */
export function refOptions(model: Model, extraHashes: (string | null | undefined)[] = []): { hash: string; label: string }[] {
  const opts = model.refs
    .filter((r) => r.type !== 'remote')
    .map((r) => ({ hash: r.hash, label: r.type === 'tag' ? `tag: ${r.name}` : r.name }))
  if (!opts.length) {
    for (const c of model.order) if (!c.children.length) opts.push({ hash: c.hash, label: `tip ${shortHash(c.hash)}` })
  }
  for (const h of extraHashes) {
    if (h && !opts.some((o) => o.hash === h) && model.commits.has(h)) {
      opts.push({ hash: h, label: `commit ${shortHash(h)}` })
    }
  }
  return opts
}

export function labelFor(model: Model, hash: string): string {
  const ref = model.refs.find((r) => r.hash === hash && r.type === 'branch') || model.refs.find((r) => r.hash === hash)
  return ref ? ref.name : shortHash(hash)
}

export function defaultComparison(model: Model): { a: string | undefined; b: string | undefined } {
  const opts = refOptions(model)
  const a = model.headHash || opts[0]?.hash
  const b = opts.find((o) => o.hash !== a)?.hash || a
  return { a, b }
}
