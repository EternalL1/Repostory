import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

/** Any Drizzle Postgres database with this schema: Neon in the app, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

let db: Db | null = null
let testDb: Db | null | undefined

/**
 * The Neon database, or null for the in-memory store: when DATABASE_URL is not set, and in local development unless
 * USE_NEON_IN_DEV=1 (`vercel env pull` puts the real database in .env.local, and local testing shouldn't write to it).
 */
export function getDb(): Db | null {
  if (testDb !== undefined) return testDb
  if (!process.env.DATABASE_URL) return null
  if (process.env.NODE_ENV === 'development' && process.env.USE_NEON_IN_DEV !== '1') return null
  db ??= drizzle(neon(process.env.DATABASE_URL), { schema }) as unknown as Db
  return db
}

/** Tests only: use another database (PGlite), null for the in-memory store, or undefined to go back to normal. */
export function setTestDb(next: Db | null | undefined) {
  testDb = next
}
