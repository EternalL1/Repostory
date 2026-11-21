// Pixel-art icons: Repostory's visual signature. Each is drawn from a character map, one character per
// pixel ('.' is empty), as crisp-edged SVG so the pixels stay sharp at any size and in both themes.

export function Pixels({ map, colors, size }) {
  const w = map[0].length
  const h = map.length
  return (
    <svg width={(size * w) / h} height={size} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true" className="flex-none">
      {map.flatMap((row, y) =>
        [...row].map((ch, x) => (colors[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={colors[ch]} /> : null)),
      )}
    </svg>
  )
}

// Repostory mark: two commits on a main line (B blue, G green) and a branch stepping off to a pink commit (P)
const LOGO = ['BBB......', 'BBB......', 'BBB......', '.BPP.....', '.B..PPPPP', '.B....PPP', 'GGG...PPP', 'GGG......', 'GGG......']
const LOGO_COLORS = { B: 'var(--color-lane-0)', G: 'var(--color-lane-1)', P: 'var(--color-lane-2)' }

// Flame for the streak: R red, O orange, Y yellow, W hot core
const FIRE = ['...R....', '...RR...', '..RRR.R.', '..RORRR.', '.RROORR.', '.ROOYORR', 'RROYYOOR', 'ROYYWYOR', 'ROYWWYOR', '.ROYYOR.', '..RRRR..']
const FIRE_COLORS = { R: '#e5482a', O: '#ff8a1f', Y: '#ffd23f', W: '#fff4b8' }

// Calendar page with green active days, the heatmap in miniature: L outline, R header, W page, G active day
const CALENDAR = ['.L.....L.', 'RRRRRRRRR', 'RRRRRRRRR', 'LWWWWWWWL', 'LWGWGWGWL', 'LWWWWWWWL', 'LWGWWWGWL', 'LWWWWWWWL', 'LLLLLLLLL']
const CALENDAR_COLORS = { L: '#7d8591', R: '#e5482a', W: '#eef1f4', G: '#2fbf71' }

// Lightning bolt for the busiest day, a spike of activity: Y yellow, O shade
const BOLT = ['...YYO', '..YYO.', '.YYO..', 'YYYYYO', '...YO.', '..YO..', '.YO...', 'YO....']
const BOLT_COLORS = { Y: '#ffd23f', O: '#e09a00' }

// Terminal with a ">_" prompt (step 1, run the command): L frame, D screen, G prompt, W cursor
const TERMINAL = ['LLLLLLLLLL', 'LDDDDDDDDL', 'LDGDDDDDDL', 'LDDGDDDDDL', 'LDGDDDDDDL', 'LDDDDWWWDL', 'LDDDDDDDDL', 'LLLLLLLLLL']
const TERMINAL_COLORS = { L: 'var(--color-muted)', D: 'var(--color-panel-2)', G: 'var(--color-path)', W: 'var(--color-fg)' }

// Clipboard (step 2, paste the output): L frame, P paper, W lines
const CLIPBOARD = ['...LLL...', '.LLWWWLL.', '.LPPPPPL.', '.LPWWWPL.', '.LPPPPPL.', '.LPWWPPL.', '.LPPPPPL.', '.LPWWWPL.', '.LLLLLLL.']
const CLIPBOARD_COLORS = { L: 'var(--color-muted)', P: 'var(--color-panel-2)', W: 'var(--color-accent)' }

// Arrow pointer ("pick a commit"): F outline, W fill
const POINTER = ['F.......', 'FF......', 'FWF.....', 'FWWF....', 'FWWWF...', 'FWWWWF..', 'FWWFFF..', 'FF.FWF..', 'F...FWF.', '....FF..']
const POINTER_COLORS = { F: 'var(--color-fg)', W: 'var(--color-panel)' }

export const PixelLogo = ({ size = 20 }) => <Pixels map={LOGO} colors={LOGO_COLORS} size={size} />
export const PixelFire = ({ size = 22 }) => <Pixels map={FIRE} colors={FIRE_COLORS} size={size} />
export const PixelCalendar = ({ size = 20 }) => <Pixels map={CALENDAR} colors={CALENDAR_COLORS} size={size} />
export const PixelBolt = ({ size = 20 }) => <Pixels map={BOLT} colors={BOLT_COLORS} size={size} />
export const PixelTerminal = ({ size = 18 }) => <Pixels map={TERMINAL} colors={TERMINAL_COLORS} size={size} />
export const PixelClipboard = ({ size = 18 }) => <Pixels map={CLIPBOARD} colors={CLIPBOARD_COLORS} size={size} />
export const PixelPointer = ({ size = 22 }) => <Pixels map={POINTER} colors={POINTER_COLORS} size={size} />
