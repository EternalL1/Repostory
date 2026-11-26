// Loads a public GitHub repository's history and writes it in the same text format as GIT_LOG_COMMAND, so the app
// reads a GitHub link exactly like a pasted log. Runs on the server with one shared token (GITHUB_TOKEN).
//
// What it loads: the default branch's newest commits up to a limit, then each other branch back to where it joins
// what is already loaded. File lists are not loaded: GitHub only gives them one commit per request, which a shared
// token can't afford for every visitor.

const API = 'https://api.github.com/graphql'
export const HISTORY_LIMIT = 2000 // commits on the default branch
const PAGE = 100 // GitHub's largest history page
const BRANCHES = 50 // most recently updated branches looked at
const BRANCH_PAGES = 3 // pages per other branch before giving up on reaching loaded history
const EXTRA_LIMIT = 1000 // commits added by other branches, in total
const PAGE_CONCURRENCY = 20 // default-branch pages in flight at once: one wave for the whole limit
const BRANCH_CONCURRENCY = 8 // branches walked at once

export type GitHubErrorCode = 'bad-input' | 'not-found' | 'rate-limited' | 'not-configured' | 'upstream'
export class GitHubError extends Error {
  constructor(
    public code: GitHubErrorCode,
    message: string,
  ) {
    super(message)
  }
}

/** "owner/name" from what people paste: a GitHub URL (any page of it), owner/name, or a clone URL. */
export function parseRepoInput(input: string): { owner: string; name: string } | null {
  const s = input.trim().replace(/\.git$/, '')
  const m =
    /^(?:https?:\/\/)?(?:www\.)?github\.com[/:]([\w.-]+)\/([\w.-]+)(?:[/?#].*)?$/i.exec(s) ||
    /^git@github\.com:([\w.-]+)\/([\w.-]+)$/i.exec(s) ||
    /^([\w.-]+)\/([\w.-]+)$/.exec(s)
  if (!m) return null
  const [owner, name] = [m[1], m[2].replace(/\.git$/, '')]
  if (owner.length > 39 || name.length > 100 || name === '.' || name === '..') return null
  return { owner, name }
}

type Gql = (query: string, variables: Record<string, unknown>) => Promise<any>

function client(token: string, fetchImpl: typeof fetch = fetch): Gql {
  return async (query, variables) => {
    let res: Response
    try {
      res = await fetchImpl(API, {
        method: 'POST',
        headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'Repostory' },
        body: JSON.stringify({ query, variables }),
      })
    } catch {
      throw new GitHubError('upstream', 'Could not reach GitHub. Try again in a moment.')
    }
    if (res.status === 401) throw new GitHubError('not-configured', 'The GitHub token was refused.')
    if (res.status === 403 || res.status === 429) {
      throw new GitHubError('rate-limited', 'GitHub’s hourly limit for Repostory is used up. Try again later, or paste the git log instead.')
    }
    if (!res.ok) throw new GitHubError('upstream', `GitHub answered ${res.status}. Try again in a moment.`)
    const body = await res.json()
    const err = body.errors?.[0]
    if (err) {
      if (err.type === 'NOT_FOUND') throw new GitHubError('not-found', 'No public repository at that address.')
      if (err.type === 'RATE_LIMITED') throw new GitHubError('rate-limited', 'GitHub’s hourly limit for Repostory is used up. Try again later, or paste the git log instead.')
      throw new GitHubError('upstream', 'GitHub could not answer that request.')
    }
    return body.data
  }
}

const HISTORY_FIELDS = `history(first: ${PAGE}, after: $after) {
  totalCount
  pageInfo { hasNextPage endCursor }
  nodes { oid messageHeadline committedDate author { name email date } parents(first: 8) { nodes { oid } } }
}`

// the repository, its refs and the default branch's first page, in one request
const REFS = `query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
    isPrivate
    mailmap: object(expression: "HEAD:.mailmap") { ... on Blob { text } }
    defaultBranchRef { name target { oid ... on Commit { ${HISTORY_FIELDS} } } }
    branches: refs(refPrefix: "refs/heads/", first: ${BRANCHES}, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
      totalCount
      nodes { name target { oid } }
    }
    tags: refs(refPrefix: "refs/tags/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
      nodes { name target { oid ... on Tag { target { oid } } } }
    }
  }
}`

const HISTORY = `query($owner: String!, $name: String!, $oid: GitObjectID!, $after: String) {
  repository(owner: $owner, name: $name) {
    object(oid: $oid) {
      ... on Commit { ${HISTORY_FIELDS} }
    }
  }
}`

type CommitNode = { oid: string; messageHeadline: string; committedDate: string; author: { name: string | null; email: string | null; date: string | null } | null; parents: { nodes: { oid: string }[] } }

export interface RepoLog {
  name: string
  text: string
  commits: number
  /** true when the default branch has more history than was loaded */
  truncated: boolean
}

type HistoryPage = { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: CommitNode[] }

/** Runs `fn` over `items` with at most `limit` running at once, keeping the results in order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/**
 * The repository's .mailmap as a lookup, the way `git log %aN` applies it: maps a commit's (name, email) to the
 * name the person wants. Supports every form gitmailmap(5) allows; emails match case-insensitively.
 */
export function mailmap(text: string | null | undefined): (name: string, email: string) => string {
  const rules: { name?: string; email: string; commitName?: string }[] = []
  for (const raw of (text || '').split('\n')) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    const m = /^([^<]*)<([^>]*)>\s*(?:([^<]*)<([^>]*)>)?$/.exec(line)
    if (!m) continue
    const [, properName, firstEmail, commitName, commitEmail] = m
    // one email: "Name <email>" sets the name for that email; two: the second email (and name, if given) is matched
    if (commitEmail === undefined) rules.push({ name: properName.trim() || undefined, email: firstEmail.toLowerCase() })
    else rules.push({ name: properName.trim() || undefined, email: commitEmail.toLowerCase(), commitName: commitName.trim() || undefined })
  }
  return (name, email) => {
    const e = email.toLowerCase()
    // the most specific rule wins: name and email over email alone
    const hit = rules.find((r) => r.email === e && r.commitName === name && r.name) || rules.find((r) => r.email === e && !r.commitName && r.name)
    return hit?.name ?? name
  }
}

// a field must not contain the log format's separators
const clean = (s: string | null | undefined) => (s || '').replace(/[|\r\n]+/g, ' ').trim()

export async function fetchRepoLog(owner: string, name: string, token: string, fetchImpl?: typeof fetch): Promise<RepoLog> {
  const gql = client(token, fetchImpl)
  const repo = (await gql(REFS, { owner, name, after: null })).repository
  if (!repo) throw new GitHubError('not-found', 'No public repository at that address.')
  if (repo.isPrivate) throw new GitHubError('not-found', 'That repository is private. Paste its git log instead.')
  if (!repo.defaultBranchRef) throw new GitHubError('not-found', 'That repository has no commits yet.')

  const commits = new Map<string, CommitNode>()
  const pageOf = async (oid: string, after: string | null): Promise<HistoryPage | undefined> =>
    (await gql(HISTORY, { owner, name, oid, after })).repository?.object?.history
  const add = (nodes: CommitNode[], budget: () => number) => {
    let fresh = 0
    for (const c of nodes) {
      if (commits.has(c.oid)) continue
      if (budget() <= 0) break
      commits.set(c.oid, c)
      fresh++
    }
    return fresh
  }

  // the default branch, newest first up to the limit. GitHub's history cursor is "<tip oid> <index of the last commit
  // read>": when the first page confirms that, every later page is requested at once instead of one after another
  const tip: string = repo.defaultBranchRef.target.oid
  const left = () => HISTORY_LIMIT - commits.size
  const first: HistoryPage | undefined = repo.defaultBranchRef.target.history
  if (!first) throw new GitHubError('not-found', 'That repository has no commits yet.')
  add(first.nodes, left)
  let truncated = false
  if (first.pageInfo.hasNextPage) {
    const pages = Math.min(Math.ceil(first.totalCount / PAGE), Math.ceil(HISTORY_LIMIT / PAGE))
    if (first.pageInfo.endCursor === `${tip} ${first.nodes.length - 1}`) {
      const rest = await mapLimit(Array.from({ length: pages - 1 }, (_, k) => k + 1), PAGE_CONCURRENCY, (k) => pageOf(tip, `${tip} ${k * PAGE - 1}`))
      for (const page of rest) if (page) add(page.nodes, left)
    } else {
      // a cursor in another shape: read page after page
      let after: string | null = first.pageInfo.endCursor
      for (let k = 1; k < pages && after && left() > 0; k++) {
        const page = await pageOf(tip, after)
        if (!page) break
        add(page.nodes, left)
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
      }
    }
    truncated = first.totalCount > commits.size
  }

  // other branches, several at a time, each only back to where it joins loaded history
  const defaultName: string = repo.defaultBranchRef.name
  const base = commits.size
  const extra = () => base + EXTRA_LIMIT - commits.size
  const others = (repo.branches.nodes as { name: string; target: { oid: string } }[]).filter((b) => b.name !== defaultName && !commits.has(b.target.oid))
  await mapLimit(others, BRANCH_CONCURRENCY, async (b) => {
    let after: string | null = null
    for (let page = 0; page < BRANCH_PAGES && extra() > 0; page++) {
      const h = await pageOf(b.target.oid, after)
      if (!h) return
      const fresh = add(h.nodes, extra)
      if (fresh < h.nodes.length || !h.pageInfo.hasNextPage) return // joined loaded history, or reached the start
      after = h.pageInfo.endCursor
    }
  })

  // refs in git's own decoration format, so the parser reads them like `git log --decorate`
  const refs = new Map<string, string[]>()
  const addRef = (oid: string, label: string) => refs.set(oid, [...(refs.get(oid) || []), label])
  addRef(repo.defaultBranchRef.target.oid, `HEAD -> ${clean(defaultName)}`)
  for (const b of repo.branches.nodes) if (b.name !== defaultName) addRef(b.target.oid, clean(b.name))
  for (const t of repo.tags.nodes as { name: string; target: { oid: string; target?: { oid: string } } }[]) {
    addRef(t.target.target?.oid ?? t.target.oid, `tag: ${clean(t.name)}`)
  }

  // names as `git log %aN` would print them; emails are only used for this and never leave the server
  const nameOf = mailmap(repo.mailmap?.text)
  const lines: string[] = []
  for (const c of commits.values()) {
    const parents = c.parents.nodes.map((p) => p.oid).join(' ')
    const date = c.author?.date || c.committedDate
    const author = clean(nameOf(c.author?.name || '', c.author?.email || '')) || 'unknown'
    lines.push(`@@${c.oid}|${parents}|${author}|${date}|${(refs.get(c.oid) || []).join(', ')}|${clean(c.messageHeadline)}`)
  }
  return { name: repo.nameWithOwner, text: lines.join('\n'), commits: commits.size, truncated }
}
