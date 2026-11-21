// Story artwork: pixel-built backdrops and avatars, in the same crisp-pixel language as components/pixel.jsx.
// The Story has its own vivid palette (it is a poster, not chrome), so colors here are fixed hex, not theme vars.

export const STORY_LANES = ['#5e9eff', '#3ddc97', '#ff7eb6', '#f5a524', '#56d4e8', '#ff6b6b', '#a3e635', '#e8a87c']

/** FNV-1a: a small stable hash, so a name always gets the same avatar and color. */
export function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic pseudo-random numbers from a seed (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 5×5 mirrored pixel grid for a name: true = filled. Shared by the avatar and the PNG export. */
export function identiconCells(name) {
  const h = hash(name)
  const cells = []
  for (let y = 0; y < 5; y++) {
    const row = []
    for (let x = 0; x < 3; x++) row.push(((h >>> (y * 3 + x)) & 1) === 1 || (x === 2 && y === 2))
    cells.push([row[0], row[1], row[2], row[1], row[0]])
  }
  return cells
}
export const identiconColor = (name) => STORY_LANES[hash(name) % STORY_LANES.length]

/** A contributor's pixel avatar. */
export function Identicon({ name, size = 40, bg = '#0b0d12', className = '', style }) {
  const cells = identiconCells(name)
  const color = identiconColor(name)
  return (
    <svg width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className={`flex-none ${className}`} style={style}>
      <rect width="7" height="7" fill={bg} />
      {cells.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x + 1} y={y + 1} width="1" height="1" fill={color} /> : null)))}
    </svg>
  )
}

// mix two hex colors, t in 0..1
function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

// Backdrops are drawn on a 90×160 pixel canvas (9:16) and scaled to cover the card.
const W = 90
const H = 160

/** Nested pixel steps, mirrored top and bottom: a stage the text stands in the middle of. */
function Stairs({ a, b, only }) {
  const rects = []
  const n = 7
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1)
    const w = W - k * 12
    const x = k * 6
    const fill = mix(a, b, t)
    if (only !== 'bottom') rects.push(<rect key={`t${k}`} x={x} y={-2} width={w} height={24 - k * 2.4} fill={fill} />)
    if (only !== 'top') rects.push(<rect key={`b${k}`} x={x} y={H - 22 + k * 2.4} width={w} height={24} fill={fill} />)
  }
  return rects
}

/** Two staircase bands crossing the corners. */
function Diagonal({ a, b }) {
  const band = (key, transform) => (
    <g key={key} transform={transform}>
      {Array.from({ length: 9 }, (_, k) => (
        <rect key={k} x={-30 + k * 3} y={k * 3.2} width={170 - k * 6} height={3.4} fill={mix(a, b, k / 8)} />
      ))}
    </g>
  )
  return [band('top', 'translate(40 -18) rotate(32)'), band('bot', 'translate(-60 128) rotate(32)')]
}

/** A checkerboard top and bottom. */
function Checker({ a, b }) {
  const rects = []
  const s = 10
  for (let y = 0; y < H / s; y++) {
    if (y > 2 && y < H / s - 3) continue
    for (let x = 0; x < W / s; x++) rects.push(<rect key={`${x}-${y}`} x={x * s} y={y * s} width={s} height={s} fill={(x + y) % 2 ? a : b} />)
  }
  return rects
}

/** Pixels drifting in from the corners, densest at the edges. */
function Scatter({ a, b, seed = 7 }) {
  const r = rng(seed)
  const rects = []
  for (let i = 0; i < 110; i++) {
    const corner = i % 2
    const d = Math.pow(r(), 1.8)
    const x = corner ? W - d * 42 - 4 : d * 42
    const y = corner ? H - Math.pow(r(), 1.8) * 50 - 4 : Math.pow(r(), 1.8) * 50
    const s = 1 + Math.floor((1 - d) * 4)
    rects.push(<rect key={i} x={Math.round(x)} y={Math.round(y)} width={s} height={s} fill={r() > 0.45 ? a : b} />)
  }
  return rects
}

/** A commit graph in giant pixels: a main line, a branch out and back, a second one still open. */
function Graph({ colors }) {
  const [c0, c1, c2] = colors
  const px = (x, y, c, k) => <rect key={k} x={x} y={y} width="4" height="4" fill={c} />
  const out = []
  // main line
  for (let y = 0; y < H; y += 4) out.push(px(14, y, c0, `m${y}`))
  for (const y of [18, 62, 110, 140]) out.push(<rect key={`mc${y}`} x={10} y={y} width="12" height="12" fill={c0} />)
  // branch 1 leaves at 30, returns at 110
  for (let i = 0; i < 6; i++) out.push(px(18 + i * 4, 30 + i * 4, c1, `b1o${i}`))
  for (let y = 54; y < 92; y += 4) out.push(px(38, y, c1, `b1${y}`))
  for (let i = 0; i < 6; i++) out.push(px(38 - i * 4, 92 + i * 3, c1, `b1i${i}`))
  out.push(<rect key="b1c" x={34} y={66} width="12" height="12" fill={c1} />)
  // branch 2: still open at the top right
  for (let i = 0; i < 9; i++) out.push(px(18 + i * 5, 128 - i * 4, c2, `b2${i}`))
  for (let y = 4; y < 96; y += 4) out.push(px(62 + ((y / 4) % 2 ? 0 : 0), y, c2, `b2v${y}`))
  for (const y of [8, 40]) out.push(<rect key={`b2c${y}`} x={58} y={y} width="12" height="12" fill={c2} />)
  return out
}

/** Full-bleed pixel backdrop for one slide. */
export function Backdrop({ variant, a, b, colors, seed }) {
  if (!variant) return null
  let body = null
  if (variant === 'stairs') body = <Stairs a={a} b={b} />
  if (variant === 'stairs-bottom') body = <Stairs a={a} b={b} only="bottom" />
  if (variant === 'diagonal') body = <Diagonal a={a} b={b} />
  if (variant === 'checker') body = <Checker a={a} b={b} />
  if (variant === 'scatter') body = <Scatter a={a} b={b} seed={seed} />
  if (variant === 'graph') body = <Graph colors={colors} />
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      className="story-backdrop pointer-events-none absolute inset-0 h-full w-full"
    >
      {body}
    </svg>
  )
}
