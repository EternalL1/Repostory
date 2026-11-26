// Saving, reading and deleting shared Stories. A share holds the computed Story stats only: the git log never leaves
// the browser, so the server cannot recompute them and stores what the Story player needs, checked by snapshotSchema.
import { createHash, randomBytes } from 'node:crypto'
import { and, count, eq, gt, lte } from 'drizzle-orm'
import { getDb } from './index'
import { shares } from './schema'
import { parseSnapshot, type Snapshot, SNAPSHOT_VERSION } from './snapshot'

export const MAX_SHARE_BYTES = 200_000
/** How long a link lives. Expired links read as missing; the daily cron deletes them. */
export const SHARE_TTL_DAYS = 365
/**
 * New links allowed across everyone per rolling hour: a ceiling on storage abuse until a per-IP rate limit exists
 * (a Vercel Firewall rule on /api/shares). Far above real use.
 */
export const MAX_SHARES_PER_HOUR = 300

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

// base64url: 64 characters, so a random byte maps to one without bias; 10 characters = 60 bits
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const SLUG = /^[A-Za-z0-9_-]{10}$/
const newSlug = () => Array.from(randomBytes(10), (b) => ALPHABET[b & 63]).join('')

const newToken = () => randomBytes(32).toString('base64url')
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Thrown when the hourly ceiling is reached; the route answers 429. */
export class SharesBusyError extends Error {}

type Row = { version: number; payload: unknown; deleteTokenHash: string; createdAt: Date; expiresAt: Date }
export type Share = { stats: Snapshot; expiresAt: Date }

// local development without DATABASE_URL keeps shares in memory until the dev server restarts
const memory: Map<string, Row> = ((globalThis as { __repostoryShares?: Map<string, Row> }).__repostoryShares ??= new Map())

function database() {
  const db = getDb()
  if (!db && process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is not set: sharing needs the Neon database.')
  return db
}

async function createdInLastHour(now: Date): Promise<number> {
  const since = new Date(now.getTime() - HOUR_MS)
  const db = database()
  if (!db) return [...memory.values()].filter((r) => r.createdAt > since).length
  const [row] = await db.select({ n: count() }).from(shares).where(gt(shares.createdAt, since))
  return row.n
}

/** Stores a checked snapshot; returns its slug, expiry and the one-time delete token (only its hash is kept). */
export async function saveShare(stats: Snapshot, now = new Date()): Promise<{ slug: string; deleteToken: string; expiresAt: Date }> {
  const db = database()
  if ((await createdInLastHour(now)) >= MAX_SHARES_PER_HOUR) throw new SharesBusyError('Too many links are being made right now.')
  const deleteToken = newToken()
  const expiresAt = new Date(now.getTime() + SHARE_TTL_DAYS * DAY_MS)
  const row: Row = { version: SNAPSHOT_VERSION, payload: stats, deleteTokenHash: hashToken(deleteToken), createdAt: now, expiresAt }
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = newSlug()
    if (!db) {
      if (memory.has(slug)) continue
      memory.set(slug, row)
      return { slug, deleteToken, expiresAt }
    }
    const rows = await db.insert(shares).values({ slug, ...row, payload: stats }).onConflictDoNothing().returning({ slug: shares.slug })
    if (rows.length) return { slug, deleteToken, expiresAt }
  }
  throw new Error('Could not pick a free share link, try again.')
}

/**
 * Reads a share back, re-checked against the current schema so a page never renders a payload it can't draw.
 * Expired rows, rows from a newer or unknown version, and rows that no longer pass all read as missing.
 */
export async function getShare(slug: string, now = new Date()): Promise<Share | null> {
  if (!SLUG.test(slug)) return null
  const db = database()
  let row: Pick<Row, 'version' | 'payload' | 'expiresAt'> | undefined
  if (db) {
    ;[row] = await db
      .select({ version: shares.version, payload: shares.payload, expiresAt: shares.expiresAt })
      .from(shares)
      .where(and(eq(shares.slug, slug), gt(shares.expiresAt, now)))
      .limit(1)
  } else {
    row = memory.get(slug)
    if (row && row.expiresAt <= now) row = undefined
  }
  if (!row) return null
  // one version so far; an older one would be upgraded here before the check
  if (row.version !== SNAPSHOT_VERSION) {
    console.error(`share ${slug}: unsupported snapshot version ${row.version}`)
    return null
  }
  const stats = parseSnapshot(row.payload)
  if (typeof stats === 'string') {
    console.error(`share ${slug}: stored payload no longer valid: ${stats}`)
    return null
  }
  return { stats, expiresAt: row.expiresAt }
}

/** Deletes a share when the token matches. 'missing' covers both an unknown slug and a wrong token. */
export async function deleteShare(slug: string, token: string): Promise<'deleted' | 'missing'> {
  if (!SLUG.test(slug) || !token) return 'missing'
  const db = database()
  const tokenHash = hashToken(token)
  if (!db) {
    if (memory.get(slug)?.deleteTokenHash !== tokenHash) return 'missing'
    memory.delete(slug)
    return 'deleted'
  }
  const rows = await db
    .delete(shares)
    .where(and(eq(shares.slug, slug), eq(shares.deleteTokenHash, tokenHash)))
    .returning({ slug: shares.slug })
  return rows.length ? 'deleted' : 'missing'
}

/** Deletes every expired share; returns how many went. Run daily by the Vercel cron. */
export async function deleteExpiredShares(now = new Date()): Promise<number> {
  const db = database()
  if (!db) {
    let n = 0
    for (const [slug, row] of memory) if (row.expiresAt <= now && memory.delete(slug)) n++
    return n
  }
  const rows = await db.delete(shares).where(lte(shares.expiresAt, now)).returning({ slug: shares.slug })
  return rows.length
}
