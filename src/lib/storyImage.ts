// Draws the Story's summary poster to a 1080×1920 PNG (the size stories use), mirroring the Summary slide.
import { STORY_LANES } from '../components/story/art'
import { GREENS } from '../components/story/CalendarGrid'
import { MASCOTS } from '../components/story/pixelArt'
import { HERO } from '../components/story/slides'
import { clock12, fileLabels, fmt, isSolo, type StoryStats, summaryLabels } from './story'

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

  // hero: the persona's mascot in its sky, as the slide draws it
  y += 3 * U
  const m = MASCOTS[s.persona.name as keyof typeof MASCOTS]
  const heroW = W - pad * 2
  const heroH = HERO.h * U
  const sky = ctx.createLinearGradient(0, y, 0, y + heroH)
  sky.addColorStop(0, m.sky[0])
  sky.addColorStop(1, m.sky[1])
  ctx.fillStyle = sky
  ctx.fillRect(pad, y, heroW, heroH)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(pad, y + heroH - HERO.ground * U, heroW, HERO.ground * U)
  const mp = (HERO.mascot * U) / 16
  const mx = pad + (heroW - HERO.mascot * U) / 2
  const my = y + heroH - (HERO.ground - 2) * U - HERO.mascot * U
  m.map.forEach((row: string, j: number) => [...row.padEnd(16, '.')].forEach((ch, i) => {
    const c = (m.colors as Record<string, string>)[ch]
    if (!c) return
    ctx.fillStyle = c
    ctx.fillRect(mx + i * mp, my + j * mp, Math.ceil(mp), Math.ceil(mp))
  }))
  // the name on its sticker, bottom left; the peak hour, bottom right
  ctx.font = `800 ${4 * U}px ${SANS}`
  const tw = ctx.measureText(s.persona.name).width
  ctx.fillStyle = m.accent
  ctx.beginPath()
  ctx.roundRect(pad + 3 * U, y + heroH - 2 * U - 5.6 * U, tw + 3.2 * U, 5.6 * U, 1.2 * U)
  ctx.fill()
  ctx.fillStyle = '#1a1028'
  ctx.fillText(s.persona.name, pad + 4.6 * U, y + heroH - 2 * U - 1.5 * U)
  ctx.font = `700 ${3 * U}px ${MONO}`
  ctx.fillStyle = m.light ? '#1a1028' : '#ffffff'
  ctx.textAlign = 'right'
  ctx.fillText(`PEAK ${clock12(s.peakHour)}`, pad + heroW - 3 * U, y + heroH - 2.6 * U - 0.6 * U)
  ctx.textAlign = 'left'
  y += heroH + 7 * U

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
  ctx.fillText('Days in the green', pad + colW + 5 * U, y + 3.4 * U)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${9 * U}px ${SANS}`
  ctx.fillText(fmt(s.commits), pad, y + 3.4 * U + 9 * U)
  ctx.fillStyle = GREENS[4]
  ctx.fillText(s.cal ? fmt(s.cal.activeDays) : '—', pad + colW + 5 * U, y + 3.4 * U + 9 * U)

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
