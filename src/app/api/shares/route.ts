import { MAX_SHARE_BYTES, saveShare, SharesBusyError } from '../../../db/shares'
import { countEvent } from '../../../db/events'
import { parseSnapshot } from '../../../db/snapshot'

/**
 * Creates a share link for a Story: POST the Story stats, get back `{ slug, deleteToken, expiresAt }`.
 * The link is /w/<slug>; the token is shown once and is the only way to delete it (DELETE /api/shares/<slug>).
 */
export async function POST(request: Request) {
  const body = await request.text()
  if (new TextEncoder().encode(body).length > MAX_SHARE_BYTES) {
    return Response.json({ error: 'This Story is too large to share.' }, { status: 413 })
  }

  let input: unknown
  try {
    input = JSON.parse(body)
  } catch {
    return Response.json({ error: 'Expected JSON.' }, { status: 400 })
  }
  const stats = parseSnapshot(input)
  if (typeof stats === 'string') return Response.json({ error: stats }, { status: 400 })

  try {
    const saved = await saveShare(stats)
    await countEvent('share_created').catch((e) => console.error('kpi: count failed', e))
    return Response.json(saved, { status: 201 })
  } catch (e) {
    if (e instanceof SharesBusyError) {
      return Response.json({ error: 'Lots of links are being made right now. Try again in a few minutes.' }, { status: 429, headers: { 'retry-after': '600' } })
    }
    console.error('share failed', e)
    return Response.json({ error: 'Could not save the share link. Try again in a moment.' }, { status: 500 })
  }
}
