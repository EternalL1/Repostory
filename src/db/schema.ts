import { index, jsonb, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core'
import type { StoryStats } from '../lib/story'

/** One row per shared Story: the computed stats only, never the git log they came from. */
export const shares = pgTable(
  'shares',
  {
    slug: text('slug').primaryKey(),
    // SNAPSHOT_VERSION when written: tells a reader which StoryStats shape the payload has
    version: smallint('version').notNull(),
    payload: jsonb('payload').$type<StoryStats>().notNull(),
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
