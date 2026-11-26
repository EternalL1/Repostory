import { date, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp } from 'drizzle-orm/pg-core'
import type { StorySnapshot } from '../lib/story'

/** One row per shared Story: the computed stats only, never the git log they came from. */
export const shares = pgTable(
  'shares',
  {
    slug: text('slug').primaryKey(),
    // SNAPSHOT_VERSION when written: tells a reader which StorySnapshot shape the payload has
    version: smallint('version').notNull(),
    payload: jsonb('payload').$type<StorySnapshot>().notNull(),
    // SHA-256 of the secret handed to whoever made the link; only they can delete it
    deleteTokenHash: text('delete_token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // past this, the link reads as missing and the daily cleanup deletes the row
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('shares_expires_at_idx').on(t.expiresAt), // the cleanup's range delete
    index('shares_created_at_idx').on(t.createdAt), // the hourly creation ceiling
  ],
)

/**
 * Product counts, one row per UTC day and event: how many repositories were loaded, Stories finished, links shared.
 * Only the event's name and the day: nothing about who, which repository, or from where.
 */
export const dailyEvents = pgTable(
  'daily_events',
  {
    day: date('day').notNull(),
    event: text('event').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.event] })],
)
