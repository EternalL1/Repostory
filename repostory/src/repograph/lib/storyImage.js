// Draws the Story's summary poster to a 1080×1920 PNG (the size stories use), mirroring the Summary slide.
import { identiconCells, identiconColor, STORY_LANES } from '../components/story/art.jsx'
import { fmt } from './story.js'

const W = 1080
const H = 1920
const U = W / 100 // 1cqw
const SANS = '"Mona Sans Variable", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
const MONO = '"Monaspace Neon", ui-monospace, Menlo, Consolas, monospace'
const LOGO = ['BBB......', 'BBB......', 'BBB......', '.BPP.....', '.B..PPPPP', '.B....PPP', 'GGG...PPP', 'GGG......', 'GGG......']
const LOGO_COLORS = { B: STORY_LANES[0], G: STORY_LANES[1], P: STORY_LANES[2] }

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

function identicon(ctx, name, x, y, size) {
  const px = size / 7
  ctx.fillStyle = '#0b0d12'
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = identiconColor(name)
  identiconCells(name).forEach((row, j) => row.forEach((on, i) => on && ctx.fillRect(x + (i + 1) * px, y + (j + 1) * px, Math.ceil(px), Math.ceil(px))))
}

export async function renderSummaryPng(s) {
  try {
    await Promise.all([document.fonts.load(`800 40px ${SANS}`), document.fonts.load(`500 40px ${MONO}`)])
  } catch {
    /* fall back to whatever font is there */
  }
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
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

  // hero
  y += 3 * U
  const heroH = 52 * U
  const heroW = W - pad * 2
  ctx.fillStyle = '#0b0d12'
  ctx.fillRect(pad, y, heroW, heroH)
  const cell = heroW / 30
  for (let j = 0; j < Math.ceil(heroH / cell); j++) {
    for (let i = 0; i < 30; i++) {
      const k = (i * 7 + j * 13 + i * j) % 11
      if (k >= 3) continue
      ctx.globalAlpha = 0.25 + k * 0.2
      ctx.fillStyle = STORY_LANES[(i + j) % STORY_LANES.length]
      ctx.fillRect(pad + i * cell, y + j * cell, Math.ceil(cell), Math.min(Math.ceil(cell), y + heroH - (y + j * cell)))
    }
  }
  ctx.globalAlpha = 1
  if (s.top[0]) {
    const size = 38 * U
    const ix = (W - size) / 2
    const iy = y + (heroH - size) / 2
    ctx.fillStyle = '#0b0d12'
    ctx.fillRect(ix - 1.2 * U, iy - 1.2 * U, size + 2.4 * U, size + 2.4 * U)
    identicon(ctx, s.top[0].name, ix, iy, size)
  }
  y += heroH + 7 * U

  // two columns
  const colW = (W - pad * 2 - 5 * U) / 2
  const col = (x, title, items) => {
    ctx.font = `500 ${3.4 * U}px ${SANS}`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(title, x, y + 3.4 * U)
    ctx.font = `700 ${4 * U}px ${SANS}`
    ctx.fillStyle = '#ffffff'
    items.forEach((t, i) => {
      const ly = y + 3.4 * U + 1.5 * U + (i + 1) * 6 * U - 1.2 * U
      ctx.fillText(String(i + 1), x, ly)
      ctx.fillText(fit(ctx, t, colW - 5 * U), x + 5 * U, ly)
    })
  }
  col(pad, 'Top contributors', s.top.map((t) => t.name))
  col(pad + colW + 5 * U, 'Most-changed files', s.hotspots.map((f) => f.path.split('/').pop()))
  y += 3.4 * U + 1.5 * U + Math.max(s.top.length, s.hotspots.length, 1) * 6 * U + 5 * U

  ctx.font = `500 ${3.4 * U}px ${SANS}`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText('Commits', pad, y + 3.4 * U)
  ctx.fillText('Team type', pad + colW + 5 * U, y + 3.4 * U)
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
export async function savePoster(s) {
  const blob = await renderSummaryPng(s)
  if (!blob) return
  const file = new File([blob], `${s.name.replace(/[^\w.-]+/g, '-')}-story.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ files: [file], title: `${s.name} on Repostory` })
      return
    } catch (e) {
      if (e?.name === 'AbortError') return // the viewer closed the share sheet
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
