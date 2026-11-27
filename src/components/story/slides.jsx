// The Story's slides. Sizes are in cqw (percent of the card's width), so a slide reads the same full-screen on a
// phone, in the desktop player and in the small poster on the Story tab.
import { useContext, useEffect, useRef, useState } from 'react'
import { PixelFire, PixelLogo } from '../pixel'
import { fileLabels, fmt, shortDay, wallLayout } from '../../lib/story'
import { Identicon } from './art'
import CalendarGrid, { GREENS } from './CalendarGrid'
import { StoryPaused } from './context'
import { PixelPage, PixelTrophy } from './pixelArt'

export const u = (n) => `${n}cqw`
const d = (ms) => ({ '--d': `${ms}ms` })

export { StoryHold, StoryPaused } from './context'

/** Counts up to `to` once, easing out; stops while the story is paused. Jumps straight there when motion is reduced. */
function useCountUp(to, ms = 1200, delay = 250) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const paused = useContext(StoryPaused)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [v, setV] = useState(reduce ? to : 0)
  useEffect(() => {
    if (reduce) return
    let raf = 0
    let elapsed = -delay // time counted only while playing
    let prev = performance.now()
    const tick = (now) => {
      if (!pausedRef.current) elapsed += now - prev
      prev = now
      const t = Math.min(1, Math.max(0, elapsed / ms))
      setV(Math.round(to * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, delay, reduce])
  return v
}

const Center = ({ children, className = '' }) => (
  <div className={`relative flex h-full flex-col items-center justify-center text-center ${className}`} style={{ padding: `0 ${u(9)}` }}>
    {children}
  </div>
)
const Headline = ({ children, delay = 0, size = 8.4, className = '' }) => (
  <h2 className={`story-rise m-0 font-extrabold text-balance ${className}`} style={{ ...d(delay), fontSize: u(size), lineHeight: 1.08, letterSpacing: '-0.025em' }}>
    {children}
  </h2>
)
// A plate in the card's own color behind text: invisible against the card, but backdrop pixels stop at the words
const halo = (bg) => ({ background: bg, padding: `${u(1.2)} ${u(2.4)}`, borderRadius: u(2), position: 'relative' })
const Sub = ({ children, delay = 400, className = '', bg = null }) => (
  <p className={`story-rise m-0 font-medium text-balance opacity-90 ${className}`} style={{ ...d(delay), fontSize: u(4.2), lineHeight: 1.35, marginTop: u(4.5), ...(bg && halo(bg)) }}>
    {children}
  </p>
)
const Big = ({ children, delay = 150, size = 24 }) => (
  <div className="story-pop font-extrabold tabular-nums" style={{ ...d(delay), fontSize: u(size), lineHeight: 0.95, letterSpacing: '-0.045em', margin: `${u(2)} 0` }}>
    {children}
  </div>
)
const basename = (p) => p.split('/').pop()
// about how many characters of a file label fit one Summary column at its type size
const SUMMARY_FILE_CHARS = 13
const dirname = (p) => p.split('/').slice(0, -1).join('/')
const firstName = (n) => n.split(' ')[0]
const pct = (x) => (x < 0.01 && x > 0 ? '<1' : Math.round(x * 100))

function Intro({ s }) {
  return (
    <div className="relative flex h-full flex-col justify-end" style={{ padding: `0 ${u(9)} ${u(22)}` }}>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[62%]" style={{ background: 'linear-gradient(transparent, #0b0d12 38%)' }} />
      <div className="story-rise relative flex items-center font-mono" style={{ ...d(100), gap: u(2), fontSize: u(3.6) }}>
        <PixelLogo size={18} />
        <span className="truncate opacity-80">{s.name}</span>
      </div>
      <h2 className="story-rise relative m-0 font-extrabold" style={{ ...d(250), fontSize: u(15), lineHeight: 0.92, letterSpacing: '-0.045em', marginTop: u(4) }}>
        The story
        <br />
        so far
      </h2>
      <p className="story-rise relative m-0 font-medium opacity-80" style={{ ...d(500), fontSize: u(4.2), marginTop: u(4) }}>
        {s.range}
      </p>
      <p className="story-rise relative m-0 font-mono opacity-60" style={{ ...d(900), fontSize: u(3.2), marginTop: u(14) }}>
        Tap to start →
      </p>
    </div>
  )
}

function Commits({ s }) {
  const n = useCountUp(s.commits)
  const pace = s.perDay >= 1 ? `That's ${s.perDay.toFixed(1)} a day, every day.` : `One every ${Math.round(1 / s.perDay)} days. Slow and steady.`
  return (
    <Center>
      <Headline>This repo shipped</Headline>
      <Big>{fmt(n)}</Big>
      <Headline delay={250} size={7}>commits in {fmt(s.spanDays)} days</Headline>
      <Sub delay={700}>{pace}</Sub>
    </Center>
  )
}

// The biggest day's ink: a rubber stamp in magenta, and the desk the calendar page sits on
const STAMP = '#d6286b'
const desk = { backgroundImage: 'radial-gradient(rgba(120,70,0,0.12) 0.35cqw, transparent 0.4cqw)', backgroundSize: `${u(4)} ${u(4)}` }

/** "Monday, Apr 6" as the parts a calendar page prints. */
function pageOf(label) {
  const [weekday, md = ''] = label.split(', ')
  const [month = '', num = ''] = md.split(' ')
  return { weekday: weekday.toUpperCase(), month: month.toUpperCase(), num, label: `${weekday}, ${month} ${num}` }
}

const Stamp = ({ top, bottom, delay, size = 4.6, style }) => (
  <div
    className="story-stamp absolute text-center font-mono font-medium uppercase"
    style={{ ...d(delay), border: `${u(0.9)} solid ${STAMP}`, color: STAMP, borderRadius: u(1), padding: `${u(1.4)} ${u(3)}`, fontSize: u(size), lineHeight: 1.05, letterSpacing: '0.06em', background: 'rgba(255,250,240,0.8)', ...style }}
  >
    {top}
    <div style={{ fontSize: u(2.6), letterSpacing: '0.12em', marginTop: u(0.6) }}>{bottom}</div>
  </div>
)

/** The biggest day as a pixel desk-calendar page: stamped with its count, and with everyone pinned around it when it took more than one person. */
function Busiest({ s }) {
  const b = s.busiest
  const page = pageOf(b.label)
  const crew = b.people && b.crew >= 2 ? b.people.slice(0, 4) : null
  if (crew) {
    const tilt = [-6, 5, -3, 7]
    const spots = [[10, 90], [54, 88], [12, 130], [54, 128]] // left and top in cqw: a 2×2 under the page
    return (
      <div className="absolute inset-0 overflow-hidden" style={desk}>
        <div className="absolute inset-x-0" style={{ top: u(20), padding: `0 ${u(8)}` }}>
          <Headline size={9} className="text-left">{b.crew === 2 ? 'Two of you, one big day' : 'All hands on deck'}</Headline>
        </div>
        <div className="story-drop absolute" style={{ ...d(150), left: u(8), top: u(40), width: u(46) }} role="img" aria-label={page.label}>
          <PixelPage month={page.month} num={page.num} weekday={page.weekday} />
        </div>
        <Stamp delay={600} size={5} top={`${b.count} commits`} bottom={`${b.crew} people`} style={{ left: u(52), top: u(52) }} />
        {crew.map((p, i) => (
          <div key={p.name} className="story-pin absolute" style={{ ...d(800 + i * 110), left: u(spots[i][0]), top: u(spots[i][1]), '--r': `${tilt[i]}deg` }}>
            <div style={{ background: '#fffaf0', padding: `${u(1.6)} ${u(1.6)} ${u(1.4)}`, boxShadow: `${u(0.6)} ${u(1)} 0 rgba(90,50,0,0.25), 0 0 0 ${u(0.6)} currentColor` }}>
              <Identicon name={p.name} style={{ width: u(22), height: u(22), display: 'block' }} />
              <div className="flex items-baseline justify-between font-bold" style={{ fontSize: u(3.4), marginTop: u(1.4), gap: u(1), width: u(22) }}>
                <span className="truncate">{firstName(p.name)}</span>
                <span className="tabular-nums" style={{ color: STAMP }}>×{p.commits}</span>
              </div>
            </div>
            {/* the pin */}
            <span className="absolute block rounded-full" style={{ left: '50%', top: u(-1.6), width: u(3), height: u(3), marginLeft: u(-1.5), background: '#e5482a', boxShadow: `inset ${u(0.5)} ${u(0.5)} 0 #ff8a6a` }} />
          </div>
        ))}
        {b.crew > crew.length && (
          <p className="story-rise absolute inset-x-0 m-0 text-center font-bold" style={{ ...d(1300), top: u(166), fontSize: u(3.6) }}>
            + {b.crew - crew.length} more
          </p>
        )}
      </div>
    )
  }
  const who = b.people?.length === 1 ? firstName(b.people[0].name) : null
  return (
    <div className="absolute inset-0 overflow-hidden" style={desk}>
      <div className="absolute inset-x-0 flex justify-center" style={{ top: u(34) }}>
        <div className="story-drop relative" style={{ ...d(100), width: u(76) }} role="img" aria-label={page.label}>
          <PixelPage month={page.month} num={page.num} weekday={page.weekday} />
          <Stamp delay={750} top={`${b.count} commits`} bottom="biggest day" style={{ right: u(-6), bottom: u(-2) }} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 text-center" style={{ padding: `0 ${u(9)} ${u(16)}` }}>
        <Headline delay={1000}>{who ? `${who}’s biggest day` : 'The biggest day'}</Headline>
        <Sub delay={1150}>
          {b.first && b.last && b.first !== b.last ? `${b.count} commits, ${b.first} to ${b.last}. ` : ''}Where did you find the time?
        </Sub>
      </div>
    </div>
  )
}

// Contribution calendar: our own green ramp on a dark card (0 = no commits)
// and inverted for the lime "best month" card: darker = more commits
const LIMES = ['rgba(10,40,0,0.10)', '#8fd629', '#5aa81a', '#2f7310', '#123d05']

/** The whole history as one green wall. */
function Calendar({ s, theme }) {
  const n = useCountUp(s.cal.activeDays)
  return (
    <div className="relative flex h-full flex-col justify-center" style={{ padding: `0 ${u(9)}` }}>
      <p className="story-rise m-0 font-mono opacity-70" style={{ ...d(0), fontSize: u(3.4) }}>Contributions</p>
      <Big size={26}>
        <span style={{ color: '#4ff0a0' }}>{fmt(n)}</span>
      </Big>
      <Headline delay={250} size={7.6}>days in the green</Headline>
      <Sub delay={450}>Out of {fmt(s.cal.spanDays)} days since the first commit.</Sub>
      <div style={{ marginTop: u(9) }}>
        <CalendarGrid cal={s.cal} travel bg={theme.bg} />
        <div className="story-rise flex items-center justify-end font-mono opacity-70" style={{ ...d(900), gap: u(1), fontSize: u(2.8), marginTop: u(2) }}>
          Less
          {GREENS.map((c, i) => (
            <span key={i} style={{ width: u(2.6), height: u(2.6), borderRadius: u(0.5), background: c }} />
          ))}
          More
        </div>
      </div>
    </div>
  )
}

/** The greenest month as big pixel squares, one per day, with the count in each. */
function BestMonth({ s }) {
  const m = s.cal.month
  return (
    <div className="relative flex h-full flex-col justify-center" style={{ padding: `0 ${u(9)}` }}>
      <p className="story-rise m-0 font-mono opacity-70" style={{ ...d(0), fontSize: u(3.4) }}>Greenest month</p>
      <Headline delay={150} size={11}>
        {m.name} {m.year}
      </Headline>
      <Sub delay={350}>
        {fmt(m.commits)} commits on {m.active} of {m.length} days.
      </Sub>
      <div className="grid grid-cols-7" style={{ gap: u(1.4), marginTop: u(8) }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
          <span key={i} className="story-rise text-center font-mono opacity-60" style={{ ...d(500), fontSize: u(3) }}>{w}</span>
        ))}
        {m.cells.map((c, i) =>
          c ? (
            <span
              key={c.t}
              className="story-cell grid aspect-square place-items-center font-mono font-bold tabular-nums"
              style={{ ...d(600 + i * 22), borderRadius: u(1.4), background: LIMES[c.level], color: c.level >= 3 ? '#e9ffd0' : 'rgba(10,40,0,0.55)', fontSize: u(3.2) }}
            >
              {c.n || ''}
            </span>
          ) : (
            <span key={`pad${i}`} />
          ),
        )}
      </div>
    </div>
  )
}

// "Tue, Jul 31 to Sun, Aug 26", with the year once the history spans years (on both ends if it crosses New Year)
function streakRange(from, to, withYear) {
  if (!withYear) return `${shortDay(from)} to ${shortDay(to)}`
  const y0 = new Date(from).getUTCFullYear()
  const y1 = new Date(to).getUTCFullYear()
  return y0 === y1 ? `${shortDay(from)} to ${shortDay(to)}, ${y1}` : `${shortDay(from)}, ${y0} to ${shortDay(to)}, ${y1}`
}

/** The longest run glowing on the dimmed calendar: two colors only (dark card, green), the flame as the one warm accent. */
function Streak({ s, theme }) {
  const { len, from, to } = s.cal.streak
  const n = useCountUp(len, 900)
  return (
    <div className="relative flex h-full flex-col justify-center" style={{ padding: `0 ${u(9)}` }}>
      <div className="story-pop flex items-center" style={{ ...d(150), gap: u(3) }}>
        <PixelFire size={56} />
        <span className="font-extrabold tabular-nums" style={{ fontSize: u(26), lineHeight: 0.95, letterSpacing: '-0.045em', color: GREENS[4] }}>{n}</span>
      </div>
      <Headline delay={300}>days, no days off</Headline>
      <Sub delay={500}>
        {streakRange(from, to, s.cal.spanDays > 366)}. The longest the squares stayed green.
      </Sub>
      <div style={{ marginTop: u(9) }}>
        <CalendarGrid cal={s.cal} delay={700} highlight={{ from, to }} bg={theme.bg} />
      </div>
    </div>
  )
}

/** 24 bars around a clock face; the peak hour lit. */
function HourRing({ hours, peak, fg, hot }) {
  const max = Math.max(1, ...hours)
  return (
    <svg viewBox="0 0 100 100" className="story-pop" style={{ ...d(200), width: u(66), height: u(66) }} aria-hidden="true">
      <circle cx="50" cy="50" r="19" fill="none" stroke={fg} strokeOpacity="0.25" strokeWidth="0.6" />
      {hours.map((n, h) => {
        const len = 3 + (n / max) * 24
        return (
          <g key={h} transform={`rotate(${h * 15} 50 50)`}>
            <rect
              className="story-grow"
              x="48.2"
              y={50 - 22 - len}
              width="3.6"
              height={len}
              fill={h === peak ? hot : fg}
              fillOpacity={h === peak ? 1 : 0.55}
              style={d(300 + h * 25)}
            />
          </g>
        )
      })}
      {[0, 6, 12, 18].map((h) => {
        const a = (h * 15 - 90) * (Math.PI / 180)
        return (
          <text key={h} x={50 + Math.cos(a) * 13} y={50 + Math.sin(a) * 13 + 1.4} textAnchor="middle" fontSize="4" fontWeight="700" fill={fg} fillOpacity="0.7">
            {String(h).padStart(2, '0')}
          </text>
        )
      })}
    </svg>
  )
}

function Clock({ s, theme }) {
  return (
    <Center>
      <Headline size={6}>This team is a</Headline>
      <Headline delay={150} size={12} className="mt-[1cqw]">
        <span style={{ color: theme.hot }}>{s.persona.name}</span>
      </Headline>
      <div style={{ margin: `${u(5)} 0` }}>
        <HourRing hours={s.hours} peak={s.peakHour} fg={theme.fg} hot={theme.hot} />
      </div>
      <Sub delay={700} className="!mt-0" bg={theme.bg}>
        Most commits landed on {s.peakWeekday} around {s.peakHourLabel}. {s.persona.line}
      </Sub>
    </Center>
  )
}

const PODIUM = [
  // 1st in the middle; sized so the trophy clears the title on the shorter desktop card (9:16) too
  { color: '#ffd23f', height: 48, avatar: 22 },
  { color: '#cfd8d3', height: 38, avatar: 17 },
  { color: '#e8a87c', height: 31, avatar: 17 },
]

/** Who made this: a podium for the top three, or an achievement when one person made all of it. */
function Contributors({ s, theme }) {
  const top = s.top.slice(0, 3)
  if (top.length < 2) {
    const a = s.top[0]
    return (
      <div className="absolute inset-0 overflow-hidden">
        {/* rays behind the trophy, fading out from its middle */}
        <div
          aria-hidden="true"
          className="story-rays absolute"
          style={{ left: '50%', top: u(64), width: u(160), height: u(160), marginLeft: u(-80), marginTop: u(-80), borderRadius: '50%', background: 'repeating-conic-gradient(rgba(255,210,63,0.13) 0 10deg, transparent 10deg 20deg)', maskImage: 'radial-gradient(closest-side, #000 30%, transparent)', WebkitMaskImage: 'radial-gradient(closest-side, #000 30%, transparent)' }}
        />
        <p className="story-banner absolute inset-x-0 m-0 text-center font-mono font-medium uppercase" style={{ ...d(0), top: u(24), fontSize: u(3.6), letterSpacing: '0.2em', color: theme.hot }}>
          Achievement unlocked
        </p>
        <div className="story-trophy absolute" style={{ ...d(150), left: '50%', top: u(36), marginLeft: u(-25) }}>
          <div className="relative overflow-hidden">
            <PixelTrophy size={u(50)} />
            <div aria-hidden="true" className="story-shine absolute inset-0" style={d(900)} />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 text-center" style={{ padding: `0 ${u(9)} ${u(16)}` }}>
          <Headline delay={700} size={11}>Solo act</Headline>
          <p className="story-rise m-0 truncate font-extrabold" style={{ ...d(800), fontSize: u(7), marginTop: u(2), color: theme.hot }}>{a.name}</p>
          <Sub delay={950}>All {fmt(a.commits)} commits, every one of them yours.</Sub>
        </div>
      </div>
    )
  }
  const order = [1, 0, 2].filter((i) => top[i]) // 2nd, 1st, 3rd from the left
  const rest = s.top.slice(3).map((a) => firstName(a.name))
  const others = s.authors - s.top.length
  const between = top.reduce((n, a) => n + a.share, 0)
  const tail = [rest.length && `Then ${rest.join(' and ')}`, others > 0 && `${rest.length ? 'plus' : 'Plus'} ${fmt(others)} ${others === 1 ? 'other' : 'others'}`].filter(Boolean).join(', ')
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 text-center" style={{ top: u(18), padding: `0 ${u(8)}` }}>
        <p className="story-rise m-0 font-mono font-medium uppercase" style={{ ...d(0), fontSize: u(3.4), letterSpacing: '0.2em', color: theme.hot }}>Top contributors</p>
        <Headline delay={100} size={10}>The podium</Headline>
      </div>
      <div className="absolute flex items-end justify-center" style={{ left: u(6), right: u(6), bottom: u(40), gap: u(2) }}>
        {order.map((i, k) => (
          <div key={top[i].name} className="flex min-w-0 flex-col items-center" style={{ width: u(28) }}>
            <div className="story-pin relative" style={d(700 + k * 120)}>
              {i === 0 && (
                <div className="absolute" style={{ left: '50%', top: u(-14), marginLeft: u(-6) }}>
                  <PixelTrophy size={u(12)} />
                </div>
              )}
              <Identicon name={top[i].name} bg="#0a2a1c" style={{ width: u(PODIUM[i].avatar), height: u(PODIUM[i].avatar), display: 'block' }} />
            </div>
            <div className="story-rise w-full truncate text-center font-bold" style={{ ...d(750 + k * 120), fontSize: u(4.2), marginTop: u(2) }}>{firstName(top[i].name)}</div>
            <div className="story-block flex w-full flex-col items-center" style={{ ...d(300 + k * 120), height: u(PODIUM[i].height), marginTop: u(1.5), background: PODIUM[i].color, color: '#0a2a1c', borderRadius: `${u(1.5)} ${u(1.5)} 0 0` }}>
              <span className="font-extrabold" style={{ fontSize: u(11), lineHeight: 1, marginTop: u(3) }}>{i + 1}</span>
              <span className="font-bold tabular-nums" style={{ fontSize: u(3.6), marginTop: u(2.5) }}>{fmt(top[i].commits)} commits</span>
              <span className="font-medium tabular-nums opacity-75" style={{ fontSize: u(3.2) }}>{pct(top[i].share)}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 text-center" style={{ padding: `0 ${u(9)} ${u(16)}` }}>
        <Sub delay={1100}>
          {tail ? `${tail}. ` : ''}
          {top.length === 3 ? 'The top three' : 'The two of them'} made {pct(between)}% of every commit.
        </Sub>
      </div>
    </div>
  )
}

function Files({ s, theme }) {
  return (
    <div className="relative flex h-full flex-col justify-center" style={{ padding: `0 ${u(7)}` }}>
      <div className="rounded-[3cqw]" style={{ background: theme.card, padding: `${u(7)} ${u(6)}` }}>
        <Headline size={6.4} className="text-left">
          {fmt(s.files)} files touched, but these changed again and again
        </Headline>
        <ol className="m-0 list-none p-0" style={{ marginTop: u(5) }}>
          {s.hotspots.map((f, i) => (
            <li key={f.path} className="story-rise flex items-baseline" style={{ ...d(400 + i * 130), gap: u(3.5), marginTop: u(3.2) }}>
              <span className="font-extrabold tabular-nums" style={{ fontSize: u(6.4), width: u(5) }}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono font-medium" style={{ fontSize: u(4.2) }}>{basename(f.path)}</span>
                {dirname(f.path) && (
                  <span className="block truncate font-mono opacity-60" style={{ fontSize: u(3) }}>{dirname(f.path)}/</span>
                )}
              </span>
              <span className="font-bold tabular-nums" style={{ fontSize: u(3.6) }}>{f.changes}×</span>
            </li>
          ))}
        </ol>
      </div>
      {/* the punchline into the next slide: lands ~1.4s before the cut (the slide runs 8s) */}
      <Sub delay={6600} className="text-center">And again.</Sub>
    </div>
  )
}

function Word({ s }) {
  return (
    <Center>
      <Headline size={6}>The word most commits open with</Headline>
      <Big size={s.topWord.word.length > 7 ? 15 : 22}>“{s.topWord.word}”</Big>
      <Sub delay={600}>
        {fmt(s.topWord.count)} times. {s.topWord.word === 'fix' ? 'Bugs never stood a chance.' : 'Say it like you mean it.'}
      </Sub>
    </Center>
  )
}

/** The poster at the end: everything on one card. Also drawn to a PNG by lib/storyImage.js. */
// The Summary hero's contribution wall, in cqw: as wide as the hero less its padding, at most WALL_H tall. A short
// history is one strip and the hero shrinks around it. storyImage draws the same.
export const WALL = { pad: 4, w: 78, h: 39 }
export const wallHeight = ({ cols, rows }) => Math.min(WALL.h, (WALL.w * rows) / cols)

/** Every week of the history as one wall of green squares, folded into bands to fill its box. */
function ContributionWall({ weeks }) {
  const layout = wallLayout(weeks.length, WALL.w / WALL.h)
  const { cols, rows } = layout
  return (
    <svg viewBox={`0 0 ${cols} ${rows}`} shapeRendering="crispEdges" aria-hidden="true" className="w-full" style={{ height: u(wallHeight(layout)) }}>
      {weeks.flatMap((week, i) =>
        week.map((c, k) => (c.out ? null : <rect key={`${i}-${k}`} x={i % cols} y={Math.floor(i / cols) * 8 + k} width="0.82" height="0.82" fill={GREENS[c.level]} />)),
      )}
    </svg>
  )
}

export function Summary({ s, animate = true, actions = false }) {
  const a = animate ? 'story-rise' : ''
  return (
    <div className="relative flex h-full flex-col" style={{ padding: `${u(13)} ${u(7)} ${actions ? u(24) : u(6)}` }}>
      <div className={`${a} flex items-center justify-between font-mono`} style={{ ...d(0), fontSize: u(3.4) }}>
        <span className="truncate opacity-80">{s.name}</span>
        <span className="font-bold" style={{ color: '#b8f34a' }}>{s.year}</span>
      </div>
      {/* hero: the whole history as one contribution wall */}
      {s.cal && (
        <div className={`${a} relative`} style={{ ...d(100), marginTop: u(3), background: '#0b0d12', padding: `${u(WALL.pad)} ${u(WALL.pad)} ${u(3)}` }}>
          <ContributionWall weeks={s.cal.weeks} />
          <div className="font-mono" style={{ fontSize: u(3), lineHeight: 1.2, marginTop: u(2.4), color: 'rgba(255,255,255,0.7)' }}>
            <span className="font-bold" style={{ color: GREENS[4] }}>{fmt(s.cal.activeDays)}</span> {s.cal.activeDays === 1 ? 'day' : 'days'} in the green
          </div>
        </div>
      )}
      <div className="grid grid-cols-2" style={{ gap: u(5), marginTop: u(7) }}>
        <div className={a} style={d(250)}>
          <div className="font-medium opacity-70" style={{ fontSize: u(3.4) }}>Top contributors</div>
          <ol className="m-0 list-none p-0" style={{ marginTop: u(1.5) }}>
            {s.top.map((t, i) => (
              <li key={t.name} className="truncate font-bold" style={{ fontSize: u(4), lineHeight: 1.5 }}>
                <span className="inline-block tabular-nums" style={{ width: u(5) }}>{i + 1}</span>
                {t.name}
              </li>
            ))}
          </ol>
        </div>
        <div className={a} style={d(350)}>
          <div className="font-medium opacity-70" style={{ fontSize: u(3.4) }}>Most-changed files</div>
          <ol className="m-0 list-none p-0" style={{ marginTop: u(1.5) }}>
            {s.hotspots.length === 0 && <li className="font-bold opacity-60" style={{ fontSize: u(4), lineHeight: 1.5 }}>—</li>}
            {fileLabels(s.hotspots.map((f) => f.path)).map((label, i) => {
              // when a folder is needed to tell two files apart, the folder shortens and the file name stays whole
              const cut = label.lastIndexOf('/') + 1
              const name = label.slice(cut)
              const folder = cut > 0 ? (label.length <= SUMMARY_FILE_CHARS ? label.slice(0, cut - 1) : '…') : ''
              return (
                <li key={s.hotspots[i].path} className="truncate font-bold" style={{ fontSize: u(4), lineHeight: 1.5 }}>
                  <span className="inline-block tabular-nums" style={{ width: u(5) }}>{i + 1}</span>
                  {folder && <span className="opacity-60">{folder}/</span>}
                  {name}
                </li>
              )
            })}
          </ol>
        </div>
        <div className={a} style={d(450)}>
          <div className="font-medium opacity-70" style={{ fontSize: u(3.4) }}>Commits</div>
          <div className="font-extrabold tabular-nums" style={{ fontSize: u(9), letterSpacing: '-0.03em' }}>{fmt(s.commits)}</div>
        </div>
        <div className={a} style={d(550)}>
          <div className="font-medium opacity-70" style={{ fontSize: u(3.4) }}>Team type</div>
          <div className="font-extrabold" style={{ fontSize: u(6.4), lineHeight: 1.15, marginTop: u(1.2) }}>{s.persona.name}</div>
        </div>
      </div>
      <div className={`${a} mt-auto flex items-center justify-between`} style={{ ...d(650), fontSize: u(3.4) }}>
        <span className="flex items-center font-bold" style={{ gap: u(2) }}>
          <PixelLogo size={16} />
          Repostory
        </span>
        <span className="font-mono opacity-70">{s.range}</span>
      </div>
    </div>
  )
}

// Each slide: its colors, its backdrop, and when it has something to say.
export const SLIDES = [
  { id: 'intro', label: 'Intro', theme: { bg: '#0b0d12', fg: '#f4f6fa' }, backdrop: { variant: 'graph', colors: ['#5e9eff', '#3ddc97', '#ff7eb6'] }, duration: 5000, render: Intro },
  { id: 'commits', label: 'Commits', theme: { bg: '#ff4fa3', fg: '#16030c' }, backdrop: { variant: 'stairs', a: '#7a0a3d', b: '#ffd23f' }, duration: 5500, render: Commits },
  { id: 'calendar', label: 'Calendar', theme: { bg: '#07120d', fg: '#eafff3' }, duration: 8500, render: Calendar, when: (s) => s.cal?.activeDays >= 1 },
  { id: 'month', label: 'Best month', theme: { bg: '#b8f34a', fg: '#0e2a04' }, duration: 8000, render: BestMonth, when: (s) => s.cal?.month.commits >= 10 },
  { id: 'streak', label: 'Streak', theme: { bg: '#0b0d12', fg: '#ffffff' }, duration: 8000, render: Streak, when: (s) => s.cal?.streak.len >= 2 },
  { id: 'clock', label: 'When', theme: { bg: '#2a1a6e', fg: '#f1edff', hot: '#a3e635' }, backdrop: { variant: 'scatter', a: '#56d4e8', b: '#7b5cff', seed: 3 }, duration: 7000, render: Clock },
  { id: 'busiest', label: 'Biggest day', theme: { bg: '#ffcc4d', fg: '#2b1600' }, duration: 6000, render: Busiest, when: (s) => s.busiest?.count >= 3 },
  { id: 'authors', label: 'Contributors', theme: { bg: '#12452f', fg: '#eafff3', hot: '#ffd23f' }, duration: 7500, render: Contributors, when: (s) => s.top.length >= 1 },
  { id: 'files', label: 'Files', theme: { bg: '#f5d547', fg: '#1a1500', card: '#fff8dc' }, backdrop: { variant: 'checker', a: '#e3be1f', b: '#f5d547' }, duration: 8000, render: Files, when: (s) => s.hotspots.length >= 3 },
  { id: 'word', label: 'Word', theme: { bg: '#ff5a4e', fg: '#1a0402' }, backdrop: { variant: 'diagonal', a: '#8f1209', b: '#ffb199' }, duration: 5500, render: Word, when: (s) => s.topWord?.count >= 3 },
  { id: 'summary', label: 'Summary', theme: { bg: '#15171c', fg: '#ffffff' }, render: (props) => <Summary {...props} actions /> },
]

export const slidesFor = (s) => SLIDES.filter((x) => !x.when || x.when(s))
