import { timingSafeEqual } from 'node:crypto'
import { deleteExpiredShares } from '../../../../db/shares'

/**
 * Deletes expired share links. Vercel Cron calls this daily (vercel.json) and sends `Authorization: Bearer
 * $CRON_SECRET` when that environment variable is set; without it the route refuses every caller.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cleanup-shares: CRON_SECRET is not set')
    return Response.json({ error: 'Not configured.' }, { status: 500 })
  }
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const deleted = await deleteExpiredShares()
  return Response.json({ deleted })
}
