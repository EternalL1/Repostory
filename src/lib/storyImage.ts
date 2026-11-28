// Draws the Story's summary poster to a 1080×1920 PNG (the size stories use), mirroring the Summary slide.
import { STORY_LANES } from '../components/story/art'
import { GREENS } from '../components/story/CalendarGrid'
import { WALL, wallHeight } from '../components/story/slides'
import { fileLabels, fmt, isSolo, type StoryStats, summaryLabels, wallLayout } from './story'

const W = 1080
const H = 1920
const U = W / 100 // 1cqw
const SANS = '"Mona Sans Variable", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
const MONO = '"Monaspace Neon", ui-monospace, Menlo, Consolas, monospace'
const LOGO = ['BBB......', 'BBB......', 'BBB......', '.BPP.....', '.B..PPPPP', '.B....PPP', 'GGG...PPP', 'GGG......', 'GGG......']
const LOGO_COLORS: Record<string, string> = { B: STORY_LANES[0], G: STORY_LANES[1], P: STORY_LANES[2] }

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

/** Fits a file label, shortening its folder before its file name ("repo…/README.md"). */
function fitPath(ctx: CanvasRenderingContext2D, label: string, max: number): string {
  if (ctx.measureText(label).width <= max) return label
  const cut = label.lastIndexOf('/') + 1
  if (!cut) return fit(ctx, label, max)
  const name = label.slice(cut)
  let folder = label.slice(0, cut - 1)
  while (folder.length > 1 && ctx.measureText(`${folder}…/${name}`).width > max) folder = folder.slice(0, -1)
  return ctx.measureText(`${folder}…/${name}`).width <= max ? `${folder}…/${name}` : fit(ctx, name, max)
}

export async function renderSummaryPng(s: StoryStats): Promise<Blob | null> {
  try {
    await Promise.all([document.fonts.load(`800 40px ${SANS}`), document.fonts.load(`500 40px ${MONO}`), document.fonts.load(`700 40px ${MONO}`)])
  } catch {
    /* fall back to whatever font is there */
  }
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#15171c'
  ctx.fillRect(0, 0, W, H)

  const pad = 7 * U
  let y = 13 * U + 3.4 * U

  // header
  ctx.font = `500 ${3.4 * U}px ${MONO}`
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText(fit(ctx, s.name, W - pad * 2 - 15 * U), pad, y)
  ctx.font = `700 ${3.4 * U}px ${MONO}`
  ctx.fillStyle = '#b8f34a'
  ctx.textAlign = 'right'
  ctx.fillText(s.year, W - pad, y)
  ctx.textAlign = 'left'

  // hero: the contribution wall, as the slide draws it
  if (s.cal) {
    y += 3 * U
    const layout = wallLayout(s.cal.weeks.length, WALL.w / WALL.h)
    const { cols, rows } = layout
    const boxW = WALL.w * U
    const boxH = wallHeight(layout) * U
    // padding, the wall, the caption line (2.4 gap + 3.6 line) and the bottom padding, as on the slide
    const heroH = WALL.pad * U + boxH + 6 * U + 3 * U
    ctx.fillStyle = '#0b0d12'
    ctx.fillRect(pad, y, W - pad * 2, heroH)
    const pitch = Math.min(boxW / cols, boxH / rows)
    const x0 = pad + WALL.pad * U + (boxW - cols * pitch) / 2
    const y0 = y + WALL.pad * U + (boxH - rows * pitch) / 2
    s.cal.weeks.forEach((week, i) => week.forEach((c, k) => {
      if (c.out) return
      ctx.fillStyle = GREENS[c.level]
      ctx.fillRect(x0 + (i % cols) * pitch, y0 + (Math.floor(i / cols) * 8 + k) * pitch, pitch * 0.82, pitch * 0.82)
    }))
    ctx.font = `700 ${3 * U}px ${MONO}`
    const days = fmt(s.cal.activeDays)
    const cy = y + heroH - 3 * U - 0.6 * U
    ctx.fillStyle = GREENS[4]
    ctx.fillText(days, pad + 4 * U, cy)
    const dx = ctx.measureText(`${days} `).width
    ctx.font = `500 ${3 * U}px ${MONO}`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(s.cal.activeDays === 1 ? 'day in the green' : 'days in the green', pad + 4 * U + dx, cy)
    y += heroH + 7 * U
  } else {
    y += 3 * U
  }

  // two columns
  const colW = (W - pad * 2 - 5 * U) / 2
  // ranked 1, 2, 3… unless it is a single name (a Story about one person)
  const col = (x: number, title: string, items: string[], paths = false, ranked = true) => {
    ctx.font = `500 ${3.4 * U}px ${SANS}`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(title, x, y + 3.4 * U)
    ctx.font = `700 ${4 * U}px ${SANS}`
    ctx.fillStyle = '#ffffff'
    items.forEach((t, i) => {
      const ly = y + 3.4 * U + 1.5 * U + (i + 1) * 6 * U - 1.2 * U
      const tx = ranked ? x + 5 * U : x
      if (ranked) ctx.fillText(String(i + 1), x, ly)
      ctx.fillText(paths ? fitPath(ctx, t, colW - 5 * U) : fit(ctx, t, x + colW - tx), tx, ly)
    })
  }
  const labels = summaryLabels(s)
  col(pad, labels.people, s.top.map((t) => t.name), false, !isSolo(s))
  col(pad + colW + 5 * U, 'Most-changed files', s.hotspots.length ? fileLabels(s.hotspots.map((f) => f.path)) : ['—'], true)
  y += 3.4 * U + 1.5 * U + Math.max(s.top.length, s.hotspots.length, 1) * 6 * U + 5 * U

  ctx.font = `500 ${3.4 * U}px ${SANS}`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('Commits', pad, y + 3.4 * U)
  ctx.fillText(labels.type, pad + colW + 5 * U, y + 3.4 * U)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${9 * U}px ${SANS}`
  ctx.fillText(fmt(s.commits), pad, y + 3.4 * U + 9 * U)
  ctx.font = `800 ${6.4 * U}px ${SANS}`
  // two words, two lines when it does not fit on one (as the slide wraps it)
  const px = pad + colW + 5 * U
  const py = y + 3.4 * U + 1.2 * U + 6.4 * U
  if (ctx.measureText(s.persona.name).width <= colW) ctx.fillText(s.persona.name, px, py)
  else {
    const [w1, ...rest] = s.persona.name.split(' ')
    ctx.fillText(fit(ctx, w1, colW), px, py)
    ctx.fillText(fit(ctx, rest.join(' '), colW), px, py + 7.4 * U)
  }

  // footer
  const fy = H - 6 * U
  const lp = (3.4 * U * 1.1) / 9
  LOGO.forEach((row, j) => [...row].forEach((ch, i) => {
    if (!LOGO_COLORS[ch]) return
    ctx.fillStyle = LOGO_COLORS[ch]
    ctx.fillRect(pad + i * lp, fy - 9 * lp + j * lp + 0.3 * U, Math.ceil(lp), Math.ceil(lp))
  }))
  ctx.font = `700 ${3.4 * U}px ${SANS}`
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Repostory', pad + 9 * lp + 2 * U, fy)
  ctx.font = `500 ${3.4 * U}px ${MONO}`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textAlign = 'right'
  ctx.fillText(s.range, W - pad, fy)

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'))
}

/** Shares the poster where the browser can (phones), otherwise downloads it. */
export async function savePoster(s: StoryStats) {
  const blob = await renderSummaryPng(s)
  if (!blob) return
  const file = new File([blob], `${s.name.replace(/[^\w.-]+/g, '-')}-story.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], title: `${s.name} on Repostory` })
      return
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return // the viewer closed the share sheet
      /* refused: fall through to a download */
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
