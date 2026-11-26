import { countEvent, isEvent } from '../../../db/events'

/**
 * Counts one product event: POST { "event": "<name>" }. Lives outside /api/ on purpose: the firewall's rate limit there
 * is shared with share links, and counting must never use up a visitor's budget for real actions.
 */
export async function POST(request: Request) {
  const body = await request.text()
  let event: unknown
  try {
    event = body.length <= 200 ? JSON.parse(body).event : null
  } catch {
    event = null
  }
  if (!isEvent(event)) return new Response(null, { status: 400 })
  try {
    await countEvent(event)
  } catch (e) {
    console.error('kpi: count failed', e) // never worth failing the visitor's page over
  }
  return new Response(null, { status: 204 })
}
