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
