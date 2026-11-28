// The Story's slides. Sizes are in cqw (percent of the card's width), so a slide reads the same full-screen on a
// phone, in the desktop player and in the small poster on the Story tab.
import { useContext, useEffect, useRef, useState } from 'react'
import { PixelLogo } from '../pixel'
import { clock12, clock12Of, fileLabels, fmt, isSolo, MONTHS, persona, summaryLabels } from '../../lib/story'
import { Identicon } from './art'
import CalendarGrid, { GREENS } from './CalendarGrid'
import { StoryHold, StoryPaused } from './context'
import { Mascot, MASCOTS, PixelFlame, PixelPage, PixelSky, PixelTrophy } from './pixelArt'

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
        {isSolo(s) ? 'Your story' : 'The story'}
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
      <Headline>{isSolo(s) ? 'You shipped' : 'This repo shipped'}</Headline>
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
  const who = isSolo(s) ? 'Your' : b.people?.length === 1 ? `${firstName(b.people[0].name)}’s` : 'The'
  return (
    <div className="absolute inset-0 overflow-hidden" style={desk}>
      <div className="absolute inset-x-0 flex justify-center" style={{ top: u(34) }}>
        <div className="story-drop relative" style={{ ...d(100), width: u(76) }} role="img" aria-label={page.label}>
          <PixelPage month={page.month} num={page.num} weekday={page.weekday} />
          <Stamp delay={750} top={`${b.count} commits`} bottom="biggest day" style={{ right: u(-6), bottom: u(-2) }} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 text-center" style={{ padding: `0 ${u(9)} ${u(16)}` }}>
        <Headline delay={1000}>{who} biggest day</Headline>
        <Sub delay={1150}>
          {b.first && b.last && b.first !== b.last ? `${b.count} commits, ${clock12Of(b.first)} to ${clock12Of(b.last)}. ` : ''}Where did you find the time?
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
      <p className="story-rise m-0 font-mono opacity-70" style={{ ...d(0), fontSize: u(3.4) }}>{isSolo(s) ? 'Your contributions' : 'Contributions'}</p>
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
      <p className="story-rise m-0 font-mono opacity-70" style={{ ...d(0), fontSize: u(3.4) }}>{isSolo(s) ? 'Your greenest month' : 'Greenest month'}</p>
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

// "Apr 13 to Apr 18": the streak's dates without weekdays, with the year once the history spans years (on both
// ends if the streak crosses New Year)
function streakDates(from, to, withYear) {
  const md = (t) => `${MONTHS[new Date(t).getUTCMonth()]} ${new Date(t).getUTCDate()}`
  if (!withYear) return `${md(from)} to ${md(to)}`
  const [y0, y1] = [new Date(from).getUTCFullYear(), new Date(to).getUTCFullYear()]
  return y0 === y1 ? `${md(from)} to ${md(to)}, ${y1}` : `${md(from)}, ${y0} to ${md(to)}, ${y1}`
}
// stars over the campfire: fixed spots, so they sit still
const STARS = Array.from({ length: 22 }, (_, i) => [(i * 37) % 97, 8 + ((i * 53) % 60), i % 3 === 0])

/**
 * The longest streak as a campfire at night: one log drops onto the pile per day (nine at most), then the fire flares
 * up, as big as the streak (it grows slower as the streak gets long), and keeps flickering.
 */
function Streak({ s }) {
  const { len, from, to } = s.cal.streak
  const logs = Math.min(len, 9)
  const flare = 200 + logs * 110
  const size = 30 + Math.min(1, Math.log2(len) / 6) * 34
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(#0a0c26, #241a4a 70%, #2c1d33)' }}>
      {STARS.map(([x, y, big], i) => (
        <span key={i} className="absolute" style={{ left: `${x}%`, top: u(y + 50), width: u(big ? 0.9 : 0.6), height: u(big ? 0.9 : 0.6), background: '#fff', opacity: big ? 0.8 : 0.5 }} />
      ))}
      <div className="absolute inset-x-0 text-center" style={{ top: u(17), padding: `0 ${u(8)}` }}>
        <div className="story-pop font-extrabold tabular-nums" style={{ ...d(flare + 400), fontSize: u(30), lineHeight: 0.9, color: '#ffd23f', textShadow: `0 0 ${u(6)} rgba(255,138,31,0.6)` }}>{len}</div>
        <Headline delay={flare + 550} size={7.6}>days by the fire</Headline>
        <p className="story-rise m-0 font-medium text-balance" style={{ ...d(flare + 700), fontSize: u(4.2), lineHeight: 1.35, marginTop: u(2), opacity: 0.85 }}>
          {isSolo(s) ? 'You' : 'The team'} kept it going, {streakDates(from, to, s.cal.spanDays > 366)}.
        </p>
      </div>
      {/* the glow on the ground, the fire, the pile */}
      <div className="absolute rounded-[50%]" style={{ left: '50%', bottom: u(30), width: u(size * 2.4), height: u(size * 0.7), marginLeft: u(-size * 1.2), background: 'radial-gradient(closest-side, rgba(255,138,31,0.45), transparent)' }} />
      <div className="story-flame absolute" style={{ ...d(flare), left: '50%', bottom: u(37), width: u(size), marginLeft: u(-size / 2) }}>
        <PixelFlame delay={flare + 700} />
      </div>
      <div className="absolute" style={{ left: '50%', bottom: u(30), width: u(56), marginLeft: u(-28), height: u(14) }}>
        {Array.from({ length: logs }, (_, i) => {
          const row = i < 4 ? 0 : i < 7 ? 1 : 2
          const count = [4, 3, 2][row]
          const inRow = i - [0, 4, 7][row]
          const r = (i % 2 ? 1 : -1) * (4 + (i % 3) * 3)
          return (
            <span
              key={i}
              className="story-log absolute"
              style={{ ...d(200 + i * 110), '--r': `${r}deg`, left: u(28 - (count * 12) / 2 + inRow * 12), bottom: u(row * 4), width: u(13), height: u(3.6), background: 'linear-gradient(#a0602a, #6b3a14)', borderRadius: u(1), boxShadow: `inset ${u(-1)} 0 0 #4a2610`, transform: `rotate(${r}deg)` }}
            />
          )
        })}
      </div>
      {len > logs && (
        <div className="story-rise absolute inset-x-0 text-center font-mono font-bold" style={{ ...d(flare), bottom: u(24), fontSize: u(3.2), color: '#ffb36b' }}>× {fmt(len)} logs</div>
      )}
      {/* sparks keep rising from the fire, staggered, each drifting its own way */}
      {Array.from({ length: 7 }, (_, i) => (
        <span
          key={i}
          className="story-spark absolute"
          style={{ ...d(flare + 300 + i * 260), '--x': u([-4, 3, -2, 5, -5, 2, 4][i]), left: `${42 + ((i * 7) % 16)}%`, bottom: u(37 + size * 0.75), width: u(i % 3 ? 0.9 : 1.2), height: u(i % 3 ? 0.9 : 1.2), background: i % 2 ? '#ffd23f' : '#ff8a1f' }}
        />
      ))}
    </div>
  )
}

// The sky through the day, as color stops by hour; the When slide's background is the sky at the shown time
const SKY = [[0, '#0b0d2e'], [5, '#2b2160'], [7, '#ff9a7a'], [9, '#6cc6ff'], [13, '#3d97ff'], [17, '#ffb36b'], [19, '#a2457a'], [21, '#2b1460'], [24, '#0b0d2e']]
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export function skyAt(t) {
  const i = SKY.findIndex(([h]) => h > t)
  const [[h0, c0], [h1, c1]] = [SKY[i - 1], SKY[i]]
  const k = (t - h0) / (h1 - h0)
  const [a, b] = [rgb(c0), rgb(c1)]
  return `#${a.map((v, j) => Math.round(v + (b[j] - v) * k).toString(16).padStart(2, '0')).join('')}`
}
// near-black or white text, whichever reads better on this sky (WCAG relative luminance; 0.186 is where the two
// inks tie). Every hour a peak can land on then reads at 5:1 or better; only passing moments of the time-lapse dip.
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const DARK_INK = '#050a14'
const inkOn = (hex) => (luminance(hex) > 0.186 ? DARK_INK : '#ffffff')
const lightSky = (hex) => inkOn(hex) === DARK_INK
const hh = (h) => String(h).padStart(2, '0')
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Plays the clock from midnight to `to` once (eased in and out), holding while the Story is paused. */
function useTimeLapse(to, ms = 1700, delay = 600) {
  const paused = useContext(StoryPaused)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [state, setState] = useState({ t: 0, landed: false })
  useEffect(() => {
    // reduced motion lands at once; decided here, not during render, so the first render matches the server's
    if (reducedMotion()) return setState({ t: to, landed: true })
    let raf = 0
    let elapsed = -delay
    let prev = performance.now()
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    const tick = (now) => {
      if (!pausedRef.current) elapsed += now - prev
      prev = now
      const k = Math.min(1, Math.max(0, elapsed / ms))
      setState({ t: ease(k) * to, landed: k >= 1 })
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, delay])
  return [state, (t) => setState({ t, landed: true })]
}

/**
 * When: a time-lapse of the day from midnight to the busiest hour. The sky, the sun or moon and whoever is awake
 * (the persona of that hour) follow the clock; once it lands, the viewer can drag through the day themselves.
 */
function When({ s }) {
  const [{ t, landed }, setT] = useTimeLapse(s.peakHour)
  const hold = useContext(StoryHold)
  const bars = useRef(null)
  const hour = Math.min(23, Math.floor(t))
  const awake = persona(hour).name
  const accent = MASCOTS[s.persona.name].accent
  const sky = skyAt(t)
  const ink = inkOn(sky)
  const max = Math.max(1, ...s.hours)
  const atPeak = Math.round(t) === s.peakHour

  // a press on the day explores it: it holds the Story and must not count as a tap to the next slide
  const scrub = (e) => {
    const r = bars.current.getBoundingClientRect()
    setT(Math.max(0, Math.min(23.99, ((e.clientX - r.left) / r.width) * 24)))
  }
  const onPointerDown = (e) => {
    if (!landed) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    hold(true)
    scrub(e)
  }
  const release = (e) => {
    e.stopPropagation()
    hold(false)
  }

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(${sky}, ${skyAt((t + 2) % 24)})`, color: ink }}>
      <div className="absolute inset-x-0 text-center" style={{ top: u(17), padding: `0 ${u(8)}` }}>
        <div className="font-mono font-extrabold tabular-nums" style={{ fontSize: u(15), lineHeight: 1, letterSpacing: '-0.03em' }}>
          {hour % 12 || 12}:{landed ? '00' : hh(Math.floor((t % 1) * 60))}
          <span style={{ fontSize: '0.4em', marginLeft: '0.2em', letterSpacing: 0 }}>{hour < 12 ? 'AM' : 'PM'}</span>
        </div>
        <div className="story-reveal" data-on={landed || undefined} style={{ marginTop: u(2) }}>
          <h2 className="m-0 font-extrabold text-balance" style={{ fontSize: u(5.6), lineHeight: 1.15 }}>
            {isSolo(s) ? 'You’re a' : 'This team is a'}{' '}
            {/* a sticker in the type's color: its own dark text reads on any sky (the color alone did not by day) */}
            <span className="whitespace-nowrap" style={{ background: accent, color: '#1a1028', padding: `0 ${u(1.6)}`, borderRadius: u(1.2) }}>
              {s.persona.name}
            </span>
          </h2>
          <p className="m-0 font-medium text-balance" style={{ fontSize: u(3.6), lineHeight: 1.35, marginTop: u(1.5), opacity: 0.85 }}>
            {atPeak ? `Most commits landed on ${s.peakWeekday} around ${clock12(s.peakHour)}. ${s.persona.line}` : `${fmt(s.hours[hour])} ${s.hours[hour] === 1 ? 'commit' : 'commits'} at ${clock12(hour)}.`}
          </p>
        </div>
      </div>
      {/* the sun or moon riding its arc across the sky */}
      <div className="absolute" style={{ left: u(4 + (t / 24) * 80), top: u(104 - Math.sin((Math.PI * t) / 24) * 34) }}>
        <PixelSky moon={!(t >= 6 && t < 19)} size={u(13)} />
      </div>
      {/* whoever is awake at this hour, at the desk */}
      <div className="absolute inset-x-0 flex justify-center" style={{ bottom: u(42) }}>
        <Mascot key={awake} name={awake} size={u(30)} className="story-swap" />
      </div>
      <div className="absolute inset-x-0" style={{ bottom: u(36), height: u(6), background: lightSky(sky) ? 'rgba(11,26,51,0.25)' : 'rgba(0,0,0,0.35)' }} />
      <div
        ref={bars}
        role="img"
        aria-label={`Commits by hour of the day, most at ${clock12(s.peakHour)}`}
        className="absolute flex items-end"
        style={{ left: u(7), right: u(7), bottom: u(14), height: u(18), gap: u(0.5), touchAction: 'none', cursor: landed ? 'ew-resize' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => e.buttons && landed && scrub(e)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {s.hours.map((n, h) => (
          <span key={h} className="flex-1" style={{ height: `${8 + (n / max) * 92}%`, borderRadius: u(0.4), background: h === hour ? accent : ink, opacity: h === hour ? 1 : h <= t ? 0.55 : 0.2 }} />
        ))}
      </div>
      <p className="story-reveal absolute inset-x-0 m-0 text-center font-mono" data-on={landed || undefined} style={{ bottom: u(8), fontSize: u(2.8), '--d': '600ms' }}>
        ← drag through the day →
      </p>
    </div>
  )
}

// Every trading card lists a weakness: one joke per persona, with a real number where it lands
const WEAKNESS = {
  // the number keeps its noun on the same line (non-breaking space), and one commit "says"
  'Night Owl': (s) => ['sunlight.', s.lateNight === 1 ? '1\u00a0commit after 10 pm says it all.' : `${fmt(s.lateNight)}\u00a0commits after 10 pm say it all.`],
  'Early Bird': () => ['anything after 6 pm.', 'Already shipped before you woke up.'],
  'Morning Maker': () => ['meetings after lunch.', 'Runs on dangerously strong coffee.'],
  'Daytime Shipper': () => ['a lunch that runs long.', 'Ships at peak sunlight.'],
  'Evening Hacker': () => ['“just one more commit.”', 'Dinner is getting cold.'],
}

/** The coder card: the persona as a holographic trading card, dealt face down from across the table and flipped over. */
function CoderCard({ s }) {
  const m = MASCOTS[s.persona.name]
  const max = Math.max(1, ...s.hours)
  const stats = [
    ['Peak hour', clock12(s.peakHour)],
    ['Best day', s.peakWeekday.replace(/s$/, '')],
    ['Late nights', fmt(s.lateNight)],
    ['Weekends', `${pct(s.weekendShare)}%`],
  ]
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: `radial-gradient(circle at 50% 45%, ${m.sky[0]}, #0b0a1a 70%)`, padding: `${u(17)} ${u(10)} ${u(14)}` }}>
      <p className="story-rise m-0 text-center font-mono font-medium uppercase" style={{ ...d(0), fontSize: u(3.4), letterSpacing: '0.2em', color: m.accent }}>
        {isSolo(s) ? 'Your coder card' : 'Your team’s coder card'}
      </p>
      <div className="relative flex flex-1 items-center">
        {/* the card's shadow on the table: small while it flies, full as it lands, lighter while it lifts to flip */}
        <div aria-hidden="true" className="story-deal-shadow absolute inset-x-[8%] rounded-[50%]" style={{ ...d(200), bottom: '8%', height: u(8), background: 'rgba(0,0,0,0.55)', filter: `blur(${u(2.5)})` }} />
        {/* the fade sits on its own wrapper, which also holds the perspective: opacity on the 3D element itself would
            flatten it (no back face), and between the card and a perspective further up it would cancel the depth */}
        <div className="story-deal-in w-full" style={{ ...d(200), perspective: u(140) }}>
        <div className="story-deal relative w-full" style={{ ...d(200), transformStyle: 'preserve-3d' }}>
          <div className="relative overflow-hidden" style={{ backfaceVisibility: 'hidden', borderRadius: u(4), padding: u(1.8), background: `linear-gradient(135deg, #ffe27a, ${m.accent} 45%, #ffe27a 60%, #b8f34a)` }}>
            <div style={{ background: '#fffaf0', borderRadius: u(2.6), padding: u(3), color: '#1a1028' }}>
              <div className="flex items-baseline justify-between" style={{ gap: u(2) }}>
                <span className="truncate font-extrabold" style={{ fontSize: u(6.2), letterSpacing: '-0.02em' }}>{s.persona.name}</span>
                <span className="font-mono font-bold tabular-nums" style={{ fontSize: u(3.4), color: '#d6286b' }}>★ {fmt(s.hours[s.peakHour])}</span>
              </div>
              <div className="relative grid place-items-center overflow-hidden" style={{ marginTop: u(2), aspectRatio: '4 / 3', borderRadius: u(1.5), background: `linear-gradient(${m.sky[0]}, ${m.sky[1]})`, boxShadow: `inset 0 0 0 ${u(0.7)} #1a1028` }}>
                <Mascot name={s.persona.name} size={u(30)} />
                <span className="absolute inset-x-0 bottom-0" style={{ height: u(4), background: 'rgba(0,0,0,0.18)' }} />
              </div>
              <p className="m-0 italic" style={{ fontSize: u(3.4), marginTop: u(2.2), opacity: 0.75 }}>“{s.persona.line}”</p>
              <div className="grid grid-cols-2 font-mono" style={{ gap: `${u(1.6)} ${u(3)}`, marginTop: u(2.6), fontSize: u(2.8) }}>
                {stats.map(([k, v]) => (
                  <div key={k} className="flex justify-between" style={{ borderBottom: `${u(0.3)} solid rgba(26,16,40,0.15)`, paddingBottom: u(0.6) }}>
                    <span style={{ opacity: 0.6 }}>{k}</span>
                    <span className="font-bold">{v}</span>
                  </div>
                ))}
              </div>
              {/* the day as an energy bar */}
              <div className="flex items-end" style={{ gap: u(0.35), height: u(6), marginTop: u(3) }}>
                {s.hours.map((n, h) => (
                  <span key={h} className="flex-1" style={{ height: `${10 + (n / max) * 90}%`, background: h === s.peakHour ? m.accent : '#1a1028', opacity: h === s.peakHour ? 1 : 0.25 + (n / max) * 0.5 }} />
                ))}
              </div>
            </div>
            {/* one holo sweep once the card has settled */}
            <div aria-hidden="true" className="story-holo pointer-events-none absolute inset-0" style={d(2000)} />
          </div>
          {/* the back, seen while it flies in */}
          <div aria-hidden="true" className="absolute inset-0 grid place-items-center" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: u(4), background: `repeating-linear-gradient(45deg, #2a1a6e 0 ${u(2)}, #3a2590 ${u(2)} ${u(4)})`, boxShadow: `inset 0 0 0 ${u(1.8)} #ffd23f` }}>
            <span className="flex items-center font-mono font-bold" style={{ gap: u(2), fontSize: u(5), color: '#ffd23f', letterSpacing: '0.2em' }}>
              <PixelLogo size={22} />
              REPOSTORY
            </span>
          </div>
        </div>
        </div>
      </div>
      {/* When just said the type and the hour; the card ends on its weakness instead */}
      <p className="story-rise m-0 text-center font-medium text-balance" style={{ ...d(2100), fontSize: u(4.2), lineHeight: 1.35, color: '#fff' }}>
        <span className="font-mono font-bold uppercase" style={{ color: m.accent, fontSize: u(3.2), letterSpacing: '0.12em' }}>Weakness: </span>
        {WEAKNESS[s.persona.name](s)[0]} <span style={{ opacity: 0.8 }}>{WEAKNESS[s.persona.name](s)[1]}</span>
      </p>
    </div>
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
          {isSolo(s) ? `You touched ${fmt(s.files)} files, but kept coming back to these` : `${fmt(s.files)} files touched, but these changed again and again`}
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
      <Headline size={6}>{isSolo(s) ? 'The word you open commits with' : 'The word most commits open with'}</Headline>
      <Big size={s.topWord.word.length > 7 ? 15 : 22}>“{s.topWord.word}”</Big>
      <Sub delay={600}>
        {fmt(s.topWord.count)} times. {s.topWord.word === 'fix' ? 'Bugs never stood a chance.' : 'Say it like you mean it.'}
      </Sub>
    </Center>
  )
}

/** The poster at the end: everything on one card. Also drawn to a PNG by lib/storyImage.js. */
// The Summary hero, in cqw: the persona's mascot in its own sky, its name on a sticker. storyImage draws the same.
export const HERO = { h: 46, mascot: 28, ground: 8 }

export function Summary({ s, animate = true, actions = false }) {
  const a = animate ? 'story-rise' : ''
  const hero = MASCOTS[s.persona.name]
  return (
    <div className="relative flex h-full flex-col" style={{ padding: `${u(13)} ${u(7)} ${actions ? u(24) : u(6)}` }}>
      <div className={`${a} flex items-center justify-between font-mono`} style={{ ...d(0), fontSize: u(3.4) }}>
        <span className="truncate opacity-80">{s.name}</span>
        <span className="font-bold" style={{ color: '#b8f34a' }}>{s.year}</span>
      </div>
      {/* hero: whoever this Story turned out to be, the persona's mascot in its sky */}
      <div className={`${a} relative overflow-hidden`} style={{ ...d(100), marginTop: u(3), height: u(HERO.h), background: `linear-gradient(${hero.sky[0]}, ${hero.sky[1]})` }}>
        <div className="absolute inset-x-0 bottom-0" style={{ height: u(HERO.ground), background: 'rgba(0,0,0,0.18)' }} />
        <div className="absolute" style={{ left: '50%', bottom: u(HERO.ground - 2), marginLeft: u(-HERO.mascot / 2) }}>
          <Mascot name={s.persona.name} size={u(HERO.mascot)} />
        </div>
        <span className="absolute font-extrabold" style={{ left: u(3), bottom: u(2), fontSize: u(4), background: hero.accent, color: '#1a1028', padding: `0 ${u(1.6)}`, borderRadius: u(1.2) }}>
          {s.persona.name}
        </span>
        <span className="absolute font-mono font-bold uppercase" style={{ right: u(3), bottom: u(2.6), fontSize: u(3), color: hero.light ? '#1a1028' : '#ffffff' }}>
          Peak {clock12(s.peakHour)}
        </span>
      </div>
      <div className="grid grid-cols-2" style={{ gap: u(5), marginTop: u(7) }}>
        <div className={a} style={d(250)}>
          <div className="font-medium opacity-70" style={{ fontSize: u(3.4) }}>{summaryLabels(s).people}</div>
          <ol className="m-0 list-none p-0" style={{ marginTop: u(1.5) }}>
            {s.top.map((t, i) => (
              <li key={t.name} className="truncate font-bold" style={{ fontSize: u(4), lineHeight: 1.5 }}>
                {!isSolo(s) && <span className="inline-block tabular-nums" style={{ width: u(5) }}>{i + 1}</span>}
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
          <div className="font-medium opacity-70" style={{ fontSize: u(3.4) }}>Days in the green</div>
          <div className="font-extrabold tabular-nums" style={{ fontSize: u(9), letterSpacing: '-0.03em', color: GREENS[4] }}>{s.cal ? fmt(s.cal.activeDays) : '—'}</div>
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
  { id: 'streak', label: 'Streak', theme: { bg: '#0a0c26', fg: '#fff4e6' }, duration: 8000, render: Streak, when: (s) => s.cal?.streak.len >= 2 },
  // the sky it lands on picks the player's chrome: dark on a daytime sky, light at night
  { id: 'clock', label: 'When', theme: (s) => ({ bg: skyAt(s.peakHour), fg: inkOn(skyAt(s.peakHour)) }), duration: 7500, render: When, when: (s) => s.hours.some((n) => n > 0) },
  { id: 'card', label: 'Coder card', theme: { bg: '#0b0a1a', fg: '#ffffff' }, duration: 7500, render: CoderCard, when: (s) => s.hours.some((n) => n > 0) },
  { id: 'busiest', label: 'Biggest day', theme: { bg: '#ffcc4d', fg: '#2b1600' }, duration: 6000, render: Busiest, when: (s) => s.busiest?.count >= 3 },
  { id: 'authors', label: 'Contributors', theme: { bg: '#12452f', fg: '#eafff3', hot: '#ffd23f' }, duration: 7500, render: Contributors, when: (s) => s.top.length >= 1 },
  { id: 'files', label: 'Files', theme: { bg: '#f5d547', fg: '#1a1500', card: '#fff8dc' }, backdrop: { variant: 'checker', a: '#e3be1f', b: '#f5d547' }, duration: 8000, render: Files, when: (s) => s.hotspots.length >= 3 },
  { id: 'word', label: 'Word', theme: { bg: '#ff5a4e', fg: '#1a0402' }, backdrop: { variant: 'diagonal', a: '#8f1209', b: '#ffb199' }, duration: 5500, render: Word, when: (s) => s.topWord?.count >= 3 },
  { id: 'summary', label: 'Summary', theme: { bg: '#15171c', fg: '#ffffff' }, render: (props) => <Summary {...props} actions /> },
]

/** The slides this Story shows, with any theme that depends on the Story (a function of it) worked out. */
export const slidesFor = (s) => SLIDES.filter((x) => !x.when || x.when(s)).map((x) => (typeof x.theme === 'function' ? { ...x, theme: x.theme(s) } : x))
