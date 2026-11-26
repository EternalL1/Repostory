// Daily product counts behind the KPIs (`npm run kpis`). An event is a name from EVENTS and nothing else; the server
// adds the UTC day. Local development without a database keeps them in memory.
import { sql } from 'drizzle-orm'
import { getDb } from './index'
import { dailyEvents } from './schema'

export const EVENTS = [
  'load_sample', // a sample repository picked on the Load tab
  'load_paste', // a pasted or dropped git log
  'load_github', // a GitHub link (counted in the browser: cached answers never reach the server)
  'story_finished', // the Story played to its last slide, on the Story tab
  'shared_story_finished', // the same, on a shared link's page
  'share_created', // a share link made (counted by the server when it saves one)
  'share_people_left_out', // a share link made with someone left out under People in this Story (sent by the browser)
] as const
export type ProductEvent = (typeof EVENTS)[number]

export const isEvent = (v: unknown): v is ProductEvent => typeof v === 'string' && (EVENTS as readonly string[]).includes(v)

const memory: Map<string, number> = ((globalThis as { __repostoryEvents?: Map<string, number> }).__repostoryEvents ??= new Map())

const utcDay = (now: Date) => now.toISOString().slice(0, 10)

/** Adds one to today's count for `event`. */
export async function countEvent(event: ProductEvent, now = new Date()): Promise<void> {
  // only the live site counts: previews share its database, and testing them would skew the numbers
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return
  const day = utcDay(now)
  const db = getDb()
  if (!db) {
    memory.set(`${day} ${event}`, (memory.get(`${day} ${event}`) ?? 0) + 1)
    return
  }
  await db
    .insert(dailyEvents)
    .values({ day, event, count: 1 })
    .onConflictDoUpdate({ target: [dailyEvents.day, dailyEvents.event], set: { count: sql`${dailyEvents.count} + 1` } })
}

/** Counts per day and event since `from` (inclusive, UTC day). */
export async function eventCounts(from: string): Promise<{ day: string; event: string; count: number }[]> {
  const db = getDb()
  if (!db) {
    return [...memory]
      .map(([k, count]) => ({ day: k.slice(0, 10), event: k.slice(11), count }))
      .filter((r) => r.day >= from)
  }
  return db.select().from(dailyEvents).where(sql`${dailyEvents.day} >= ${from}`)
}
