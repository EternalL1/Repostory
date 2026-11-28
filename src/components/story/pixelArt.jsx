// Big pixel art for the Story: drawn the same way as the icons in pixel.jsx (crisp-edged SVG rects), but sized by
// the card (width 100% of their box) instead of in fixed pixels.

// pixel type for the calendar page: 5×7 digits, 3×5 capitals (M, N, W wider)
const DIGITS = {
  0: [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '],
  1: ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', ' ### '],
  2: [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
  3: ['#####', '   # ', '  #  ', '   # ', '    #', '#   #', ' ### '],
  4: ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '],
  5: ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
  6: ['  ## ', ' #   ', '#    ', '#### ', '#   #', '#   #', ' ### '],
  7: ['#####', '    #', '   # ', '  #  ', ' #   ', ' #   ', ' #   '],
  8: [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
  9: [' ### ', '#   #', '#   #', ' ####', '    #', '   # ', ' ##  '],
}
const LETTERS = {
  A: ['###', '# #', '###', '# #', '# #'], B: ['## ', '# #', '## ', '# #', '## '], C: [' ##', '#  ', '#  ', '#  ', ' ##'],
  D: ['## ', '# #', '# #', '# #', '## '], E: ['###', '#  ', '## ', '#  ', '###'], F: ['###', '#  ', '## ', '#  ', '#  '],
  G: [' ##', '#  ', '# #', '# #', ' ##'], H: ['# #', '# #', '###', '# #', '# #'], I: ['###', ' # ', ' # ', ' # ', '###'],
  J: ['  #', '  #', '  #', '# #', ' # '], L: ['#  ', '#  ', '#  ', '#  ', '###'], M: ['#   #', '## ##', '# # #', '#   #', '#   #'],
  N: ['#  #', '## #', '# ##', '#  #', '#  #'], O: ['###', '# #', '# #', '# #', '###'], P: ['###', '# #', '###', '#  ', '#  '],
  R: ['###', '# #', '## ', '# #', '# #'], S: [' ##', '#  ', ' # ', '  #', '## '], T: ['###', ' # ', ' # ', ' # ', ' # '],
  U: ['# #', '# #', '# #', '# #', '###'], V: ['# #', '# #', '# #', '# #', ' # '], W: ['#   #', '#   #', '# # #', '## ##', '#   #'],
  Y: ['# #', '# #', ' # ', ' # ', ' # '],
}
const glyphs = (text, font) => [...text].map((ch) => font[ch]).filter(Boolean)
const textWidth = (text, font, scale) => {
  const gs = glyphs(text, font)
  return gs.reduce((w, g) => w + g[0].length * scale, 0) + Math.max(0, gs.length - 1) * scale
}
/** rects for `text` in a pixel font, left edge at x, top at y, each font pixel `scale` units */
function pixelText(text, font, x, y, scale, fill, key) {
  const out = []
  let cx = x
  glyphs(text, font).forEach((g, i) => {
    g.forEach((row, ry) => [...row].forEach((ch, rx) => {
      if (ch === '#') out.push(<rect key={`${key}-${i}-${rx}-${ry}`} x={cx + rx * scale} y={y + ry * scale} width={scale} height={scale} fill={fill} />)
    }))
    cx += g[0].length * scale + scale
  })
  return out
}

/** The calendar page as pixel art on a 44 × 48 grid: binder rings, red header, cream page, amber shadow. */
export function PixelPage({ month, num, weekday }) {
  const W = 44
  const ink = '#2b1600'
  const r = []
  const px = (x, y, w, h, fill, k) => r.push(<rect key={k} x={x} y={y} width={w} height={h} fill={fill} />)
  // shadow under the page, offset down: the page sits on the desk
  px(3, 46, 38, 2, '#e6a817', 'sh1')
  px(4, 48, 36, 1, '#d99a0f', 'sh2')
  // outline, with the corner pixels stepped in for a rounded pixel corner
  px(3, 2, 38, 1, ink, 'o-t'); px(3, 45, 38, 1, ink, 'o-b'); px(2, 3, 1, 42, ink, 'o-l'); px(41, 3, 1, 42, ink, 'o-r')
  // header: highlight row, red band, darker bottom edge
  px(3, 3, 38, 1, '#ff7a5c', 'h-hi')
  px(3, 4, 38, 6, '#e5482a', 'h')
  px(3, 10, 38, 1, '#b8331b', 'h-lo')
  // page: cream with a slightly darker right edge and bottom for depth
  px(3, 11, 38, 34, '#fffaf0', 'p')
  px(39, 11, 2, 34, '#f1e7d2', 'p-r')
  px(3, 43, 38, 2, '#f1e7d2', 'p-b')
  // binder rings over the header
  for (const [i, x] of [11, 31].entries()) {
    px(x, 0, 2, 6, '#3b2a12', `ring${i}`)
    px(x, 0, 1, 5, '#7a6038', `ring-hi${i}`)
  }
  // month in the header, the day number big, the weekday under it
  const mW = textWidth(month, LETTERS, 1)
  r.push(...pixelText(month, LETTERS, Math.round((W - mW) / 2), 5, 1, '#fff', 'm'))
  const dScale = 3
  const dW = textWidth(String(num), DIGITS, dScale)
  r.push(...pixelText(String(num), DIGITS, Math.round((W - dW) / 2), 14, dScale, ink, 'd'))
  // the full weekday when it fits with room to spare (MONDAY), else three letters (WED)
  const wd = textWidth(weekday, LETTERS, 1) <= 30 ? weekday : weekday.slice(0, 3)
  const wW = textWidth(wd, LETTERS, 1)
  r.push(...pixelText(wd, LETTERS, Math.round((W - wW) / 2), 38, 1, '#8a6a3c', 'w'))
  return (
    <svg viewBox="0 0 44 49" shapeRendering="crispEdges" aria-hidden="true" style={{ width: '100%', height: 'auto', display: 'block' }}>
      {r}
    </svg>
  )
}

// Trophy: Y gold, W shine, O shade and handles, B base
const TROPHY = [
  '..YYYYYYYY..', 'OOYWYYYYYYOO', 'O.YWYYYYYY.O', 'O.YWYYYYYY.O', '.OYWYYYYYYO.', '..YYYYYYYY..',
  '...YYYYYY...', '....OYYO....', '.....YY.....', '.....YY.....', '....OOOO....', '...BBBBBB...', '...BBBBBB...',
]
const TROPHY_COLORS = { Y: '#ffd23f', W: '#fff4b8', O: '#e09a00', B: '#5a3a12' }

/** A pixel trophy as wide as `size` (any CSS length). */
export const PixelTrophy = ({ size }) => (
  <svg viewBox="0 0 12 13" shapeRendering="crispEdges" aria-hidden="true" style={{ width: size, height: 'auto', display: 'block' }}>
    {TROPHY.flatMap((row, y) => [...row].map((ch, x) => (TROPHY_COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={TROPHY_COLORS[ch]} /> : null)))}
  </svg>
)

// The five personas as mascots (16 × 16), with the sky they live in and an accent color for their slide
export const MASCOTS = {
  'Night Owl': {
    map: ['..D..........D', '..DD........DD', '..DBBBBBBBBBBD', '.DBBBBBBBBBBBBD', '.DBWWWBBBBWWWBD', '.DWWKKWBBWKKWWD', '.DWWKKWBBWKKWWD', '.DBWWWBYYBWWWBD', '.DBBBBBYYBBBBBD', '.DBBLLLBBLLLBBD', '.DBLLLLLLLLLLBD', '.DBLLLLLLLLLLBD', '.DBBLLLLLLLLBBD', '..DBBBBBBBBBBD', '...DDDDDDDDDD', '....OO....OO'],
    colors: { D: '#3b2412', B: '#8a5a2b', W: '#fff8e1', K: '#141020', Y: '#ffb02e', L: '#e9c99a', O: '#ff8a3d' },
    sky: ['#120f3a', '#2b2370'], ink: '#f1edff', accent: '#a78bfa', light: false,
  },
  'Early Bird': {
    map: ['', '......YYYY', '.....YYYYYY', '....YYYYYYYY', '....YYKYYYYY', '...OOYYYYYYYY', '..OOOYYYYYYYYY', '...OOYYYWWYYYY', '....YYYWWWWYYY', '....YYYYWWYYYY', '....YYYYYYYYY', '.....YYYYYYYY', '......YYYYYY', '.......O..O', '......OO.OO', ''],
    colors: { Y: '#ffd23f', W: '#fff4b8', K: '#2a1400', O: '#ff7a1a' },
    sky: ['#ff8f7a', '#ffd9a0'], ink: '#2a0f12', accent: '#ff7a1a', light: true,
  },
  'Morning Maker': {
    map: ['....S...S...S', '.....S...S...S', '....S...S...S', '.....S...S...S', '', '..MMMMMMMMMM', '..MCCCCCCCCM', '..MMMMMMMMMMMM', '..MMMMMMMMMM.MM', '..MMWMMMMMMM..M', '..MMWMMMMMMM..M', '..MMMMMMMMMM.MM', '..MMMMMMMMMMMM', '..MMMMMMMMMM', '...MMMMMMMM', '.PPPPPPPPPPPP'],
    colors: { S: '#ffffff', M: '#ff5a4e', C: '#5a3214', W: '#ffb3ab', P: '#1d4a6e' },
    sky: ['#57bdf7', '#d2f0ff'], ink: '#062037', accent: '#ff5a4e', light: true,
  },
  'Daytime Shipper': {
    map: ['.......Y', '...Y...Y...Y', '....Y.....Y', '......OOOO', '.....OOOOOO', 'YY..OOOOOOOO..YY', '...OKKKOOKKKO', '...OKKKKKKKKO', '...OOKKOOKKOO', '....OOOOOOOO', '....OOWOOWOO', '.....OOWWOO', '......OOOO', '....Y.....Y', '...Y...Y...Y', '.......Y'],
    colors: { Y: '#fff1a8', O: '#ffc21a', K: '#141020', W: '#7a3d00' },
    sky: ['#2a86f5', '#9fd4ff'], ink: '#03142e', accent: '#ffc21a', light: true,
  },
  'Evening Hacker': {
    map: ['..K..........K', '..KK........KK', '..KGK......KGK', '..KGGKKKKKKGGK', '..KGGGGGGGGGGK', '.KGGGGGGGGGGGGK', '.KGGEEGGGGEEGGK', '.KGGEKGGGGEKGGK', '.KGGGGGPPGGGGGK', '.KGGGGGGGGGGGGK', '..KGGGGGGGGGGK', '...KKKKKKKKKK', '..LLLLLLLLLLLL', '..LSSSSSSSSSSL', '..LSSSSSSSSSSL', '.LLLLLLLLLLLLLL'],
    colors: { K: '#1a1028', G: '#7c7a8c', E: '#a3e635', P: '#ff7eb6', L: '#c9ccd6', S: '#56d4e8' },
    sky: ['#2b1460', '#ff8a5b'], ink: '#fff1e6', accent: '#ff8a5b', light: false,
  },
}

/** A persona's mascot as wide as `size` (any CSS length). Rows shorter than 16 are padded with empty pixels. */
export function Mascot({ name, size, className = '' }) {
  const { map, colors } = MASCOTS[name]
  const rows = map.map((r) => r.padEnd(16, '.'))
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true" className={className} style={{ width: size, height: 'auto', display: 'block' }}>
      {rows.flatMap((row, y) => [...row].map((ch, x) => (colors[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={colors[ch]} /> : null)))}
    </svg>
  )
}

// Sun and moon for the When slide's sky: Y gold, W shine, M moonlight
const SUN = ['..YYY..', '.YYYYY.', 'YYYWYYY', 'YYWYYYY', 'YYYYYYY', '.YYYYY.', '..YYY..']
const MOON = ['..MMM..', '.MMM...', 'MMM....', 'MMM....', 'MMM....', '.MMM...', '..MMM..']
const SKY_COLORS = { Y: '#ffd23f', W: '#fff4b8', M: '#f4f1d8' }
export const PixelSky = ({ moon, size }) => (
  <svg viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" style={{ width: size, height: 'auto', display: 'block' }}>
    {(moon ? MOON : SUN).flatMap((row, y) => [...row].map((ch, x) => (SKY_COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={SKY_COLORS[ch]} /> : null)))}
  </svg>
)

// The campfire's flame: R red, O orange, Y yellow, W hot core
const FLAME = ['......R.......', '.....RR....R..', '....RRR...RR..', '...RRORR.RRR..', '...ROORRRROR..', '..RROYORRROR..', '..ROYYOORROOR.', '.RROYWYOOROYR.', '.ROYWWYYOOYYOR', 'RROYWWWYYOYWOR', 'ROYYWWWWYYWWYR', 'ROYWWWWWWWWYOR', '.ROYWWWWWWYOR.', '..ROYYYYYYOR..']
const FLAME_COLORS = { R: '#e5482a', O: '#ff8a1f', Y: '#ffd23f', W: '#fff4b8' }

/** The pixel campfire flame, as wide as its box. */
export const PixelFlame = () => (
  <svg viewBox="0 0 14 14" shapeRendering="crispEdges" aria-hidden="true" style={{ width: '100%', display: 'block' }}>
    {FLAME.flatMap((row, y) => [...row].map((ch, x) => (FLAME_COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={FLAME_COLORS[ch]} /> : null)))}
  </svg>
)

// A log for the campfire, lying on its side with its end grain showing: T tan ring, L light core, B bark, D shadow
const LOG = ['.TTBBBBBBBBBB.', 'TLTBBBBBBBBBBB', 'TLTDBBBBBBBBBB', '.TTDDDDDDDDDD.']
const LOG_COLORS = { T: '#d9a066', L: '#f0c890', B: '#8a5228', D: '#5a3214' }
export const PixelLog = () => (
  <svg viewBox="0 0 14 4" shapeRendering="crispEdges" aria-hidden="true" style={{ width: '100%', display: 'block' }}>
    {LOG.flatMap((row, y) => [...row].map((ch, x) => (LOG_COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={LOG_COLORS[ch]} /> : null)))}
  </svg>
)
