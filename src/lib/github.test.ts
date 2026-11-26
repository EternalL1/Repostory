import { describe, expect, it } from 'vitest'
import { GET } from '../app/api/github/route'
import { buildModel } from './git'
import { fetchRepoLog, GitHubError, HISTORY_LIMIT, mailmap, parseRepoInput } from './github'

type Node = { oid: string; parents: string[]; when: number }

// A fake GitHub GraphQL endpoint over a tiny commit graph: answers the refs query and paged history queries
function fakeGitHub(graph: Node[], opts: { branches: [string, string][]; tags?: [string, string][]; defaultBranch?: string; isPrivate?: boolean; githubCursors?: boolean; mailmap?: string } = { branches: [] }) {
  const byOid = new Map(graph.map((n) => [n.oid, n]))
  const calls: string[] = []
  const history = (tip: string) => {
    // every ancestor of tip, newest first (git log order)
    const seen = new Set<string>()
    const stack = [tip]
    while (stack.length) {
      const o = stack.pop()!
      if (seen.has(o) || !byOid.has(o)) continue
      seen.add(o)
      stack.push(...byOid.get(o)!.parents)
    }
    return [...seen].map((o) => byOid.get(o)!).sort((a, b) => b.when - a.when)
  }
  const node = (n: Node) => ({
    oid: n.oid,
    messageHeadline: `commit ${n.oid}`,
    committedDate: new Date(n.when * 3_600_000).toISOString(),
    author: { name: `Dev ${n.oid.length % 3}`, email: `dev${n.oid.length % 3}@example.com`, date: new Date(n.when * 3_600_000).toISOString().replace('Z', '+08:00') },
    parents: { nodes: n.parents.map((oid) => ({ oid })) },
  })
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const { query, variables } = JSON.parse(String(init.body))
    if (query.includes('defaultBranchRef')) {
      calls.push('refs')
      const def = opts.defaultBranch ?? opts.branches[0][0]
      return Response.json({
        data: {
          repository: {
            nameWithOwner: 'acme/app',
            isPrivate: !!opts.isPrivate,
            mailmap: opts.mailmap ? { text: opts.mailmap } : null,
            defaultBranchRef: { name: def, target: { oid: opts.branches.find(([n]) => n === def)![1], history: page(opts.branches.find(([n]) => n === def)![1], null) } },
            branches: { totalCount: opts.branches.length, nodes: opts.branches.map(([name, oid]) => ({ name, target: { oid } })) },
            tags: { nodes: (opts.tags ?? []).map(([name, oid]) => ({ name, target: { oid } })) },
          },
        },
      })
    }
    calls.push(`history ${variables.oid} ${variables.after ?? 0}`)
    return Response.json({ data: { repository: { object: { history: page(variables.oid, variables.after) } } } })
  }) as unknown as typeof fetch
  // one history page, newest first, from `after` (GitHub-style "<oid> <index>" or the plain style)
  function page(oid: string, after: string | null) {
    const all = history(oid)
    // GitHub's cursors read "<tip oid> <index of the last commit read>"; the plain style tests the page-by-page fallback
    const github = /^\S+ (\d+)$/.exec(after ?? '')
    const from = github ? Number(github[1]) + 1 : after ? Number(after) : 0
    const nodes = all.slice(from, from + 100)
    const endCursor = opts.githubCursors ? `${oid} ${from + nodes.length - 1}` : String(from + 100)
    return { totalCount: all.length, pageInfo: { hasNextPage: from + 100 < all.length, endCursor }, nodes: nodes.map(node) }
  }
  return { fetchImpl, calls }
}

const linear = (n: number, prefix = 'c'): Node[] => Array.from({ length: n }, (_, i) => ({ oid: `${prefix}${i}`, parents: i ? [`${prefix}${i - 1}`] : [], when: i }))

describe('parseRepoInput', () => {
  it('reads the ways people paste a repository', () => {
    for (const s of ['acme/app', 'https://github.com/acme/app', 'github.com/acme/app', 'https://github.com/acme/app.git', 'https://github.com/acme/app/tree/main/src', 'git@github.com:acme/app.git', ' acme/app ']) {
      expect(parseRepoInput(s)).toEqual({ owner: 'acme', name: 'app' })
    }
  })

  it('refuses anything that is not a GitHub repository', () => {
    for (const s of ['', 'acme', 'https://gitlab.com/acme/app', 'acme/app/extra', 'a b/c', 'acme/..']) expect(parseRepoInput(s)).toBeNull()
  })
})

describe('mailmap', () => {
  it('maps names the way git log %aN does', () => {
    const map = mailmap(`# comment
Ana Reyes <ana@work.com>
<ben@work.com> <ben@home.net>
Carla Santos <carla@work.com> carla <CARLA@home.net>
EternalL1 <one@mail.com> Eternall <two@mail.com>`)
    expect(map('ana', 'ana@work.com')).toBe('Ana Reyes') // name for an email
    expect(map('ana r', 'ANA@WORK.COM')).toBe('Ana Reyes') // emails match regardless of case
    expect(map('Ben', 'ben@home.net')).toBe('Ben') // an email-only mapping keeps the name
    expect(map('carla', 'carla@home.net')).toBe('Carla Santos') // name + email matched
    expect(map('Someone else', 'carla@home.net')).toBe('Someone else') // name doesn't match the rule
    expect(map('Eternall', 'two@mail.com')).toBe('EternalL1')
    expect(map('Dev', 'dev@x.com')).toBe('Dev')
    expect(mailmap(null)('Dev', 'dev@x.com')).toBe('Dev')
  })
})

describe('fetchRepoLog', () => {
  // main: c0 - c1 - c2 - m (merges f1); feature f0 - f1 merged into m; open branch o0 off c1
  const graph: Node[] = [
    { oid: 'c0', parents: [], when: 0 },
    { oid: 'c1', parents: ['c0'], when: 1 },
    { oid: 'f0', parents: ['c1'], when: 2 },
    { oid: 'c2', parents: ['c1'], when: 3 },
    { oid: 'f1', parents: ['f0'], when: 4 },
    { oid: 'm', parents: ['c2', 'f1'], when: 5 },
    { oid: 'o0', parents: ['c1'], when: 6 },
  ]
  const github = () => fakeGitHub(graph, { branches: [['main', 'm'], ['open', 'o0'], ['feature', 'f1']], tags: [['v1', 'c2']] })

  it('writes every branch in the git log format, with refs, so the app parses it like a paste', async () => {
    const { fetchImpl } = github()
    const log = await fetchRepoLog('acme', 'app', 'token', fetchImpl)
    expect(log).toMatchObject({ name: 'acme/app', commits: 7, truncated: false })
    const model = buildModel(log.text, log.name)
    expect(model.stats).toMatchObject({ commits: 7, merges: 1, roots: 1 })
    expect(model.headHash).toBe('m')
    expect(model.branches.map((b) => b.name).sort()).toEqual(['feature', 'main', 'open'])
    expect(model.tags.map((t) => t.name)).toEqual(['v1'])
    expect(model.commits.get('m')!.files).toEqual([]) // file lists aren't loaded from GitHub
  })

  it('reads a branch only back to the history already loaded', async () => {
    const { fetchImpl, calls } = github()
    await fetchRepoLog('acme', 'app', 'token', fetchImpl)
    // refs, the main branch, the open branch; "feature" is already inside main's history, so it costs nothing
    expect(calls).toEqual(['refs', 'history o0 0'])
  })

  it('pages through long histories and stops at the limit', async () => {
    const short = fakeGitHub(linear(250), { branches: [['main', 'c249']] })
    expect(await fetchRepoLog('acme', 'app', 't', short.fetchImpl)).toMatchObject({ commits: 250, truncated: false })
    expect(short.calls.filter((c) => c.startsWith('history'))).toHaveLength(2) // pages 2 and 3; page 1 came with the refs

    const long = fakeGitHub(linear(HISTORY_LIMIT + 150), { branches: [['main', `c${HISTORY_LIMIT + 149}`]] })
    expect(await fetchRepoLog('acme', 'app', 't', long.fetchImpl)).toMatchObject({ commits: HISTORY_LIMIT, truncated: true })
  })

  it('requests every page at once when the cursor has GitHub’s shape, with the same result', async () => {
    const graph = linear(HISTORY_LIMIT + 150)
    const tip = `c${HISTORY_LIMIT + 149}`
    const parallel = fakeGitHub(graph, { branches: [['main', tip]], githubCursors: true })
    const sequential = fakeGitHub(graph, { branches: [['main', tip]] })
    const a = await fetchRepoLog('acme', 'app', 't', parallel.fetchImpl)
    const b = await fetchRepoLog('acme', 'app', 't', sequential.fetchImpl)
    expect(a).toEqual(b)
    expect(a).toMatchObject({ commits: HISTORY_LIMIT, truncated: true })
    // page 1 comes with the refs; pages 2..20 by constructed cursor ("<tip> 99", "<tip> 199", …)
    const pages = parallel.calls.filter((c) => c.startsWith('history'))
    expect(pages).toHaveLength(HISTORY_LIMIT / 100 - 1)
    expect(pages[0]).toBe(`history ${tip} ${tip} 99`)
  })

  it('never asks for pages past the start of a small history', async () => {
    const small = fakeGitHub(linear(150), { branches: [['main', 'c149']], githubCursors: true })
    expect(await fetchRepoLog('acme', 'app', 't', small.fetchImpl)).toMatchObject({ commits: 150, truncated: false })
    expect(small.calls.filter((c) => c.startsWith('history'))).toHaveLength(1)
  })

  it('applies the repository’s .mailmap and keeps emails out of the log', async () => {
    const { fetchImpl } = fakeGitHub(graph, { branches: [['main', 'm']], mailmap: 'Dana One <dev1@example.com>\nDana One <dev2@example.com>' })
    const log = await fetchRepoLog('acme', 'app', 't', fetchImpl)
    expect(new Set(buildModel(log.text).order.map((c) => c.author))).toEqual(new Set(['Dana One']))
    expect(log.text).not.toContain('@example.com')
  })

  it('keeps the log format intact when names contain its separators', async () => {
    const { fetchImpl } = fakeGitHub([{ oid: 'a', parents: [], when: 1 }], { branches: [['main', 'a']] })
    const log = await fetchRepoLog('acme', 'app', 't', fetchImpl)
    expect(log.text.split('\n')).toHaveLength(1)
    expect(log.text.startsWith('@@a||Dev 1|')).toBe(true)
  })

  it('explains private, missing and rate-limited repositories', async () => {
    const priv = fakeGitHub(graph, { branches: [['main', 'm']], isPrivate: true })
    await expect(fetchRepoLog('acme', 'app', 't', priv.fetchImpl)).rejects.toMatchObject({ code: 'not-found', message: expect.stringMatching(/private/) })

    const answer = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as unknown as typeof fetch
    await expect(fetchRepoLog('a', 'b', 't', answer({ data: { repository: null }, errors: [{ type: 'NOT_FOUND' }] }))).rejects.toMatchObject({ code: 'not-found' })
    await expect(fetchRepoLog('a', 'b', 't', answer({ errors: [{ type: 'RATE_LIMITED' }] }))).rejects.toMatchObject({ code: 'rate-limited' })
    await expect(fetchRepoLog('a', 'b', 't', answer({}, 403))).rejects.toMatchObject({ code: 'rate-limited' })
    await expect(fetchRepoLog('a', 'b', 't', answer({}, 401))).rejects.toBeInstanceOf(GitHubError)
  })
})

describe('GET /api/github', () => {
  const call = (repo: string) => GET(new Request(`http://x/api/github?repo=${encodeURIComponent(repo)}`))

  it('refuses input that is not a repository', async () => {
    const res = await call('not a repo')
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/GitHub repository link/)
  })

  it('says plainly when the server has no GitHub token', async () => {
    const saved = process.env.GITHUB_TOKEN
    delete process.env.GITHUB_TOKEN
    try {
      const res = await call('acme/app')
      expect(res.status).toBe(500)
      expect((await res.json()).error).toMatch(/isn’t set up/)
    } finally {
      if (saved) process.env.GITHUB_TOKEN = saved
    }
  })
})
