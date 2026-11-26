// The shape of a shared Story, checked field by field on the way in and on the way out. A share is public text on
// our domain, so every string from the user's repo (repo name, people, paths, branches) has a hard length limit, and
// everything Repostory itself words (persona, weekday, month) must be one of its own values.
import { z } from 'zod'
import type { StoryStats } from '../lib/story'

/** Bump when StoryStats changes shape; getShare upgrades or refuses older rows. */
export const SNAPSHOT_VERSION = 1

const count = z.number().int().nonnegative().max(1e9)
const ts = z.number().int().nonnegative() // a calendar day as epoch ms
const ratio = z.number().min(0).max(1)
const level = z.number().int().min(0).max(4)
const text = (max: number) => z.string().max(max)
const months = z.array(count).length(12)

const PERSONAS = ['Night Owl', 'Early Bird', 'Morning Maker', 'Daytime Shipper', 'Evening Hacker'] as const
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'] as const
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

const calendar = z.object({
  weeks: z.array(z.array(z.object({ t: ts, n: count, level, out: z.boolean() })).length(7)).max(1200),
  activeDays: count,
  spanDays: count,
  streak: z.object({ len: count, from: ts.nullable(), to: ts.nullable() }),
  month: z.object({
    name: z.enum(MONTHS),
    year: z.number().int().min(1970).max(2200),
    commits: count,
    active: count,
    length: z.number().int().min(28).max(31),
    cells: z.array(z.object({ t: ts, n: count, level, date: z.number().int().min(1).max(31) }).nullable()).max(37),
  }),
})

// unknown keys are stripped (zod's default), so a client can't store anything the Story doesn't read
export const snapshotSchema = z.object({
  name: text(100).min(1),
  year: z.string().regex(/^(\d{4})?$/),
  range: text(60),
  spanDays: count.min(1),
  commits: count.min(1),
  perDay: z.number().nonnegative().max(1e6),
  activeDays: count,
  streak: count,
  busiest: z.object({ label: text(40), count }).nullable(),
  hours: z.array(count).length(24),
  peakHour: z.number().int().min(0).max(23),
  peakHourLabel: z.string().regex(/^\d{2}:00$/),
  peakWeekday: z.enum(WEEKDAYS),
  weekendShare: ratio,
  lateNight: count,
  persona: z.object({ name: z.enum(PERSONAS), line: text(80) }),
  authors: count.min(1),
  top: z
    .array(z.object({ name: text(100).min(1), commits: count, fileChanges: count, merges: count, share: ratio, months, peakMonth: z.number().int().min(0).max(11) }))
    .max(5),
  repoMonths: months,
  peakMonth: z.enum(MONTHS),
  files: count,
  hotspots: z.array(z.object({ path: text(300).min(1), changes: count, authors: count })).max(5),
  // the opening word of commit subjects, as leadWord() picks it: one lowercase word
  topWord: z.object({ word: z.string().regex(/^[a-z][a-z'-]{0,24}$/), count }).nullable(),
  merges: count,
  branches: count,
  tags: count,
  flow: z.object({ from: text(100), into: text(100), count }).nullable(),
  cal: calendar.nullable(),
}) satisfies z.ZodType<StoryStats>

export type Snapshot = z.infer<typeof snapshotSchema>

/** The cleaned snapshot, or a short reason it was refused (the first problem found). */
export function parseSnapshot(input: unknown): Snapshot | string {
  const r = snapshotSchema.safeParse(input)
  if (r.success) return r.data
  const issue = r.error.issues[0]
  const where = issue.path.length ? issue.path.join('.') : 'the Story'
  return `Invalid ${where}: ${issue.message}`
}
