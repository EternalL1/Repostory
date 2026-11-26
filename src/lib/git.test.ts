import { describe, expect, it } from 'vitest'
import { buildModel, compareCommits, mergeBases, onlyAuthors, parseLog, parseRefs } from './git'
import { sampleLogText } from './sample'

// Builds git log text from [hash, parents, refs?] rows, newest first, like the real command prints it
const log = (rows: [string, string[], string?][]) =>
  rows.map(([h, parents, refs = '']) => `@@${h}|${parents.join(' ')}|Ana|2026-10-01T09:00:00+08:00|${refs}|commit ${h}`).join('\n')

// The hand-written sample (src/lib/sample.js): main, staging, feature branches, a tag, an abandoned branch
const sample = buildModel(sampleLogText(), 'sample')
const bySubject = (subject: string) => {
  const c = sample.order.find((x) => x.subject === subject)
  if (!c) throw new Error(`no commit "${subject}"`)
  return c
}
const MAIN = bySubject("Merge branch 'staging' into main")
const STAGING = bySubject('Refactor MainActivity into screens')
const DARK_MODE = bySubject('Persist theme preference')
const OLD_EXPORT = bySubject('Export results to CSV (WIP)')

describe('parseRefs', () => {
  it('reads HEAD, tags, remotes and branches', () => {
    expect(parseRefs('HEAD -> main, tag: v0.1, origin/main, feature/x')).toEqual([
      { name: 'main', type: 'branch', head: true },
      { name: 'v0.1', type: 'tag' },
      { name: 'origin/main', type: 'remote' },
      { name: 'feature/x', type: 'branch', head: false },
    ])
  })

  it('skips a detached HEAD and remote HEAD pointers', () => {
    expect(parseRefs('HEAD, origin/HEAD')).toEqual([])
  })
})

describe('parseLog', () => {
  it('reads every commit with its files', () => {
    const commits = parseLog(sampleLogText())
    expect(commits.size).toBe(22)
    expect(commits.get(MAIN.hash)?.files).toEqual(['README.md'])
  })

  it('keeps a | inside the subject', () => {
    const c = [...parseLog('@@a||Ana|2026-10-01T09:00:00Z||fix a | b').values()][0]
    expect(c.subject).toBe('fix a | b')
  })

  it('rejects text with no commit lines', () => {
    expect(() => parseLog('just some text')).toThrow(/No commits found/)
  })

  it('rejects a commit line with missing fields', () => {
    expect(() => parseLog('@@abc|def|Ana')).toThrow(/wrong format/)
  })
})

describe('buildModel', () => {
  it('orders every commit before its parents (topological order)', () => {
    for (const c of sample.order) for (const p of c.parents) expect(c.row).toBeLessThan(sample.commits.get(p)!.row)
  })

  it('counts merges, roots and tips', () => {
    expect(sample.stats).toMatchObject({ commits: 22, merges: 5, roots: 1, tips: 4 })
  })

  it('puts a straight line in one lane', () => {
    const m = buildModel(log([['c', ['b']], ['b', ['a']], ['a', []]]))
    expect(m.laneCount).toBe(1)
    expect(m.order.map((c) => c.lane)).toEqual([0, 0, 0])
  })

  it('gives every commit a lane inside the lane count, and every parent edge a lane', () => {
    for (const c of sample.order) {
      expect(c.lane).toBeGreaterThanOrEqual(0)
      expect(c.lane).toBeLessThan(sample.laneCount)
      expect(c.edgeLanes).toHaveLength(c.parents.length)
      for (const l of c.edgeLanes) expect(l).toBeGreaterThanOrEqual(0)
    }
  })

  it('drops duplicate parents and parents missing from a shallow log', () => {
    const m = buildModel(log([['b', ['a', 'a', 'gone']], ['a', []]]))
    expect(m.commits.get('b')!.parents).toEqual(['a'])
  })

  it('finds the longest path through the sample', () => {
    // feature/dark-mode back to the root, through charts, the staging merges and the login branch
    expect(sample.longest.length).toBe(16)
    expect(sample.longest.tip).toBe(DARK_MODE.hash)
    expect(sample.longest.root).toBe(bySubject('Initial commit').hash)
  })

  it('marks HEAD and an abandoned branch as stale', () => {
    expect(sample.headHash).toBe(MAIN.hash)
    expect(sample.branches.find((b) => b.name === 'feature/old-export')?.stale).toBe(true)
    expect(sample.branches.find((b) => b.name === 'main')?.stale).toBe(false)
  })
})

describe('merge-bases', () => {
  const baseOf = (a: string, b: string) => compareCommits(sample, a, b).mergeBases

  it('finds where staging and main diverged', () => {
    expect(baseOf(MAIN.hash, STAGING.hash)).toEqual([bySubject("Merge branch 'feature/charts' into staging").hash])
  })

  it('finds where a feature branch left staging', () => {
    expect(baseOf(DARK_MODE.hash, STAGING.hash)).toEqual([bySubject('Settings screen').hash])
    expect(baseOf(OLD_EXPORT.hash, MAIN.hash)).toEqual([bySubject('Add navigation scaffold').hash])
  })

  it('returns both bases of a criss-cross merge', () => {
    const m = buildModel(log([['a', ['x', 'y']], ['b', ['y', 'x']], ['x', ['r']], ['y', ['r']], ['r', []]]))
    const { commits } = m
    const bases = mergeBases(commits, compareCommits(m, 'a', 'b').aSet, compareCommits(m, 'a', 'b').bSet)
    expect(bases.sort()).toEqual(['x', 'y'])
  })

  it('returns none for histories that share nothing', () => {
    const m = buildModel(log([['a', []], ['pages', []]]))
    expect(compareCommits(m, 'a', 'pages').mergeBases).toEqual([])
  })
})

describe('compareCommits', () => {
  it('tells diverged, contained and same apart', () => {
    expect(compareCommits(sample, MAIN.hash, STAGING.hash).relation).toBe('diverged')
    expect(compareCommits(sample, STAGING.hash, bySubject('Settings screen').hash).relation).toBe('a-contains-b')
    expect(compareCommits(sample, bySubject('Settings screen').hash, STAGING.hash).relation).toBe('b-contains-a')
    expect(compareCommits(sample, MAIN.hash, MAIN.hash).relation).toBe('same')
  })

  it('lists the commits only on each side, newest first', () => {
    const r = compareCommits(sample, DARK_MODE.hash, STAGING.hash)
    expect(r.aOnly.map((c) => c.subject)).toEqual(['Persist theme preference', 'Dark mode toggle'])
    expect(r.bOnly.map((c) => c.subject)).toEqual(['Refactor MainActivity into screens'])
  })
})

describe('onlyAuthors', () => {
  it('keeps only the chosen people’s commits, with their files and refs', () => {
    const dan = onlyAuthors(sample, new Set(['Dan Lim']))
    expect(new Set(dan.order.map((c) => c.author))).toEqual(new Set(['Dan Lim']))
    expect(dan.stats.commits).toBe(sample.order.filter((c) => c.author === 'Dan Lim').length)
    expect(dan.commits.get(DARK_MODE.hash)!.files).toEqual(DARK_MODE.files)
    expect(dan.branches.map((b) => b.name)).toEqual(['feature/dark-mode'])
    expect(dan.name).toBe(sample.name)
  })

  it('keeps HEAD and tags on the commits that stay', () => {
    const ana = onlyAuthors(sample, new Set(['Ana Reyes']))
    expect(ana.headHash).toBe(MAIN.hash)
    expect(ana.tags.map((t) => t.name)).toEqual(['v0.1'])
  })

  it('refuses to leave nobody', () => {
    expect(() => onlyAuthors(sample, new Set())).toThrow(/at least one person/)
  })
})
