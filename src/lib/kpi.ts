// Counts a product moment for the KPIs (see src/db/events.ts): sends only the event's name, after the page has moved
// on, and never surfaces an error. sendBeacon survives the page closing; fetch with keepalive is the fallback.
export type ProductEvent = 'load_sample' | 'load_paste' | 'load_github' | 'story_finished' | 'shared_story_finished' | 'share_people_left_out'

export function count(event: ProductEvent) {
  const body = JSON.stringify({ event })
  try {
    if (navigator.sendBeacon?.('/kpi/event', new Blob([body], { type: 'application/json' }))) return
  } catch {
    /* fall through */
  }
  fetch('/kpi/event', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {})
}
