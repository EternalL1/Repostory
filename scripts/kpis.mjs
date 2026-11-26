// Prints Repostory's KPIs from the production database: the last 7 UTC days against the 7 before.
// Run `npx vercel env pull .env.local` once so DATABASE_URL is available, then `npm run kpis`.
import { neon } from '@neondatabase/serverless'

try {
  process.loadEnvFile('.env.local')
} catch {
  /* use the environment as it is */
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run `npx vercel env pull .env.local` first.')
  process.exit(1)
}
const sql = neon(process.env.DATABASE_URL)

const DAY = 86_400_000
const day = (offset) => new Date(Date.now() - offset * DAY).toISOString().slice(0, 10)
const today = day(0)
const thisWeek = day(6) // the last 7 days, today included
const lastWeek = day(13)

const rows = await sql`select day::text as day, event, count from daily_events where day >= ${lastWeek}`
const live = (await sql`select count(*)::int as n from shares where expires_at > now()`)[0].n

const sum = (events, from, to) => rows.filter((r) => events.includes(r.event) && r.day >= from && r.day <= to).reduce((a, r) => a + r.count, 0)
const week = (events) => [sum(events, thisWeek, today), sum(events, lastWeek, day(7))]
const change = ([now, before]) => (before ? `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%` : now ? 'new' : '–')
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '–')

const lines = [
  ['Shares created (main KPI)', ['share_created']],
  ['   with people left out', ['share_people_left_out']],
  ['Own repo loaded (paste + GitHub)', ['load_paste', 'load_github']],
  ['   pasted git log', ['load_paste']],
  ['   GitHub link', ['load_github']],
  ['Sample picked', ['load_sample']],
  ['Stories finished', ['story_finished']],
  ['Shared Stories finished', ['shared_story_finished']],
]
const pad = (s, n) => String(s).padEnd(n)
const lpad = (s, n) => String(s).padStart(n)
console.log(`\nRepostory KPIs, UTC days. This week: ${thisWeek} → ${today}. Previous: ${lastWeek} → ${day(7)}\n`)
console.log(`${pad('', 34)}${lpad('this week', 10)}${lpad('previous', 10)}${lpad('change', 9)}`)
for (const [label, events] of lines) {
  const w = week(events)
  console.log(`${pad(label, 34)}${lpad(w[0], 10)}${lpad(w[1], 10)}${lpad(change(w), 9)}`)
}
const [own] = week(['load_paste', 'load_github'])
const [finished] = week(['story_finished'])
const [shared] = week(['share_created'])
console.log(`\nThis week's funnel: ${own} own repos → ${finished} Stories finished (${pct(finished, own)}) → ${shared} shared (${pct(shared, finished)})`)
console.log(`Share links live now: ${live}`)
console.log('Visitors, referrers and views of shared links (/w/… pages): Vercel → repostory → Analytics\n')
