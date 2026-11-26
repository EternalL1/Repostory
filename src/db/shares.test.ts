import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GET as cleanup } from '../app/api/cron/cleanup-shares/route'
import { DELETE } from '../app/api/shares/[slug]/route'
import { POST as kpiEvent } from '../app/kpi/event/route'
import { POST } from '../app/api/shares/route'
import { buildModel } from '../lib/git'
import { SAMPLES } from '../lib/samples'
import { storyStats, toSnapshot } from '../lib/story'
import { deleteExpiredShares, deleteShare, getShare, MAX_SHARE_BYTES, MAX_SHARES_PER_HOUR, saveShare, SHARE_TTL_DAYS, SharesBusyError } from './shares'
import { countEvent, eventCounts, EVENTS } from './events'
import { type Db, setTestDb } from './index'
import * as schema from './schema'
import { parseSnapshot, type Snapshot } from './snapshot'

const statsOf = (id: string) => {
  const s = SAMPLES.find((x) => x.id === id)!
  return JSON.parse(JSON.stringify(toSnapshot(storyStats(buildModel(s.text(), s.name)))))
}
const valid = (id = 'android') => parseSnapshot(statsOf(id)) as Snapshot
const DAY = 86_400_000
const memory = () => (globalThis as { __repostoryShares?: Map<string, { version: number }> }).__repostoryShares!
// the real migrations, in order, so the tests check the SQL that production runs
const DRIZZLE = new URL('../../drizzle/', import.meta.url)
const MIGRATION = readdirSync(DRIZZLE)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(new URL(f, DRIZZLE), 'utf8').replaceAll('--> statement-breakpoint', ''))
  .join('\n')
const eventMemory = () => (globalThis as { __repostoryEvents?: Map<string, number> }).__repostoryEvents

describe('parseSnapshot', () => {
  it('accepts every sample Story after a JSON round trip, under the size limit', () => {
    for (const s of SAMPLES) {
      const stats = statsOf(s.id)
      expect(JSON.stringify(stats).length).toBeLessThan(MAX_SHARE_BYTES)
      expect(parseSnapshot(stats)).toEqual(stats)
    }
  })

  it('fits a 30-year history in a few KB: one count per day', () => {
    const counts = Array.from({ length: Math.round(30 * 365.25) }, (_, i) => (i % 5 ? (i * 7) % 6 : 0))
    const input = { ...statsOf('android'), daily: { start: Date.UTC(1996, 10, 26), counts } }
    expect(JSON.stringify(input).length).toBeLessThan(40_000)
    expect(typeof parseSnapshot(input)).toBe('object')
  })

  it('drops the expanded calendar if a client sends one', () => {
    const input = { ...statsOf('android'), cal: { weeks: [] } }
    expect(parseSnapshot(input)).not.toHaveProperty('cal')
  })

  it('drops keys the Story does not read, at any depth', () => {
    const input = statsOf('android')
    input.gitLog = 'secret'
    input.top[0].email = 'ana@example.com'
    const cleaned = parseSnapshot(input) as Snapshot
    expect(cleaned).not.toHaveProperty('gitLog')
    expect(cleaned.top[0]).not.toHaveProperty('email')
  })

  it('refuses free text where the Story holds its own words', () => {
    const input = statsOf('android')
    input.persona.name = 'Visit evil.example to claim your prize'
    expect(parseSnapshot(input)).toMatch(/^Invalid persona\.name/)
    const word = statsOf('android')
    word.topWord = { word: 'click https://evil.example', count: 9 }
    expect(parseSnapshot(word)).toMatch(/^Invalid topWord\.word/)
  })

  it('limits the length of names and paths from the repo', () => {
    const input = statsOf('android')
    input.hotspots[0].path = 'Your account is locked. Verify at evil.example '.repeat(20)
    expect(parseSnapshot(input)).toMatch(/^Invalid hotspots\.0\.path/)
  })

  it('refuses wrong types and shapes deep in the Story', () => {
    const name = statsOf('android')
    name.top[0].name = 12345
    expect(parseSnapshot(name)).toMatch(/^Invalid top\.0\.name/)
    const day = statsOf('android')
    day.daily.counts[3] = -1
    expect(parseSnapshot(day)).toMatch(/^Invalid daily\.counts\.3/)
    const start = statsOf('android')
    start.daily.start += 3_600_000
    expect(parseSnapshot(start)).toMatch(/^Invalid daily\.start: must be a calendar day/)
    expect(parseSnapshot({ ...statsOf('android'), commits: 0 })).toMatch(/^Invalid commits/)
    expect(parseSnapshot(null)).toMatch(/^Invalid the Story/)
  })
})

// every store test runs twice: against the in-memory store (local dev) and against Postgres (PGlite, in process)
describe.each(['memory', 'postgres'] as const)('with the %s store', (backend) => {
  let pg: PGlite | undefined

  beforeAll(async () => {
    if (backend === 'memory') return setTestDb(null)
    pg = new PGlite()
    await pg.exec(MIGRATION)
    setTestDb(drizzle(pg, { schema }) as unknown as Db)
  })
  afterAll(async () => {
    setTestDb(undefined)
    await pg?.close()
  })
  beforeEach(async () => {
    memory().clear()
    eventMemory()?.clear()
    await pg?.exec('DELETE FROM shares; DELETE FROM daily_events')
  })

  const exists = async (slug: string) =>
    pg ? (await pg.query('SELECT 1 FROM shares WHERE slug = $1', [slug])).rows.length > 0 : memory().has(slug)
  const setVersion = async (slug: string, version: number) => {
    if (pg) await pg.query('UPDATE shares SET version = $1 WHERE slug = $2', [version, slug])
    else memory().get(slug)!.version = version
  }

  describe('share store', () => {
    it('saves, reads back by slug, and deletes only with the token', async () => {
      const stats = valid('dotfiles')
      const { slug, deleteToken } = await saveShare(stats)
      expect(slug).toMatch(/^[A-Za-z0-9_-]{10}$/)
      expect(deleteToken.length).toBeGreaterThanOrEqual(40)
      expect((await getShare(slug))?.stats).toEqual(stats)

      expect(await deleteShare(slug, 'wrong-token')).toBe('missing')
      expect((await getShare(slug))?.stats).toEqual(stats)
      expect(await deleteShare(slug, deleteToken)).toBe('deleted')
      expect(await getShare(slug)).toBeNull()
      expect(await deleteShare(slug, deleteToken)).toBe('missing')
    })

    it('reads malformed slugs as missing', async () => {
      expect(await getShare('nope')).toBeNull()
      expect(await getShare('../../etc/x')).toBeNull()
    })

    it('reads a row from an unknown snapshot version as missing', async () => {
      const { slug } = await saveShare(valid())
      await setVersion(slug, 99)
      expect(await getShare(slug)).toBeNull()
    })
  })

  describe('expiry', () => {
    const t0 = new Date('2026-11-26T12:00:00Z')

    it('expires a link SHARE_TTL_DAYS after it was made', async () => {
      const { slug, expiresAt } = await saveShare(valid(), t0)
      expect(expiresAt.getTime() - t0.getTime()).toBe(SHARE_TTL_DAYS * DAY)
      expect((await getShare(slug, new Date(expiresAt.getTime() - 1)))?.expiresAt).toEqual(expiresAt)
      expect(await getShare(slug, expiresAt)).toBeNull()
    })

    it('cleanup deletes expired links and keeps the rest', async () => {
      const old = await saveShare(valid(), new Date(t0.getTime() - (SHARE_TTL_DAYS + 1) * DAY))
      const fresh = await saveShare(valid(), t0)
      expect(await deleteExpiredShares(t0)).toBe(1)
      expect(await exists(old.slug)).toBe(false)
      expect(await exists(fresh.slug)).toBe(true)
      expect(await deleteExpiredShares(t0)).toBe(0)
    })
  })

  describe('hourly ceiling', () => {
    it(`refuses new links after ${MAX_SHARES_PER_HOUR} in a rolling hour`, async () => {
      const t0 = new Date('2026-11-26T12:00:00Z')
      const stats = valid('dotfiles')
      for (let i = 0; i < MAX_SHARES_PER_HOUR; i++) await saveShare(stats, t0)
      await expect(saveShare(stats, new Date(t0.getTime() + 30 * 60_000))).rejects.toBeInstanceOf(SharesBusyError)
      await expect(saveShare(stats, new Date(t0.getTime() + 61 * 60_000))).resolves.toHaveProperty('slug')
    })
  })

  describe('share API', () => {
    const post = (body: string) => POST(new Request('http://x/api/shares', { method: 'POST', body }))
    const del = (slug: string, token?: string) =>
      DELETE(new Request(`http://x/api/shares/${slug}`, { method: 'DELETE', headers: token ? { authorization: `Bearer ${token}` } : {} }), {
        params: Promise.resolve({ slug }),
      })

    it('creates a share (201) and deletes it with its token (204)', async () => {
      const res = await post(JSON.stringify(statsOf('android')))
      expect(res.status).toBe(201)
      const { slug, deleteToken } = await res.json()
      expect((await del(slug)).status).toBe(404)
      expect((await del(slug, 'wrong')).status).toBe(404)
      expect((await del(slug, deleteToken)).status).toBe(204)
      expect((await del(slug, deleteToken)).status).toBe(404)
    })

    it('returns when the link expires', async () => {
      const res = await post(JSON.stringify(statsOf('android')))
      const { expiresAt } = await res.json()
      expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan((SHARE_TTL_DAYS - 1) * DAY)
    })

    it('answers 400 for bad JSON or a bad Story, 413 for a huge body', async () => {
      expect((await post('nope')).status).toBe(400)
      const bad = await post(JSON.stringify({ ...statsOf('android'), name: '' }))
      expect(bad.status).toBe(400)
      expect((await bad.json()).error).toMatch(/^Invalid name/)
      expect((await post('x'.repeat(MAX_SHARE_BYTES + 1))).status).toBe(413)
    })
  })

  describe('cleanup cron', () => {
    const call = (auth?: string) => cleanup(new Request('http://x/api/cron/cleanup-shares', { headers: auth ? { authorization: auth } : {} }))

    it('refuses everyone when CRON_SECRET is not set', async () => {
      delete process.env.CRON_SECRET
      expect((await call('Bearer anything')).status).toBe(500)
    })

    it('runs only with the right secret', async () => {
      process.env.CRON_SECRET = 'test-secret'
      try {
        expect((await call()).status).toBe(401)
        expect((await call('Bearer wrong')).status).toBe(401)
        const ok = await call('Bearer test-secret')
        expect(ok.status).toBe(200)
        expect(await ok.json()).toEqual({ deleted: 0 })
      } finally {
        delete process.env.CRON_SECRET
      }
    })
  })

  describe('product counts', () => {
    const today = new Date().toISOString().slice(0, 10)
    const send = (body: string) => kpiEvent(new Request('http://x/kpi/event', { method: 'POST', body }))

    it('adds up per UTC day and event', async () => {
      const d1 = new Date('2026-11-27T23:59:00Z')
      const d2 = new Date('2026-11-28T00:01:00Z')
      await countEvent('load_paste', d1)
      await countEvent('load_paste', d1)
      await countEvent('load_paste', d2)
      await countEvent('story_finished', d2)
      const rows = (await eventCounts('2026-11-27')).map((r) => `${r.day} ${r.event} ${r.count}`).sort()
      expect(rows).toEqual(['2026-11-27 load_paste 2', '2026-11-28 load_paste 1', '2026-11-28 story_finished 1'])
      expect(await eventCounts('2026-11-28')).toHaveLength(2)
    })

    it('counts only known event names, from the route', async () => {
      expect((await send(JSON.stringify({ event: 'load_github' }))).status).toBe(204)
      expect((await send(JSON.stringify({ event: 'drop table' }))).status).toBe(400)
      expect((await send('not json')).status).toBe(400)
      expect((await send(JSON.stringify({ event: 'load_github', pad: 'x'.repeat(300) }))).status).toBe(400)
      expect(await eventCounts(today)).toEqual([{ day: today, event: 'load_github', count: 1 }])
      expect(EVENTS).toContain('share_created')
    })

    it('counts a share link when one is saved', async () => {
      await POST(new Request('http://x/api/shares', { method: 'POST', body: JSON.stringify(statsOf('android')) }))
      expect(await eventCounts(today)).toEqual([{ day: today, event: 'share_created', count: 1 }])
    })
  })
})
