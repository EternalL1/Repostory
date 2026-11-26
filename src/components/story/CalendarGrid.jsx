// The contribution calendar on the Calendar and Streak slides. A square is always one day and never shrinks below
// the size of a one-year strip; how the history is laid out depends on its length (calendarLayout in lib/story):
//   month up to 5 weeks: a calendar page, weekdays across, one row per week, the date in each day
//   fit   up to a year: the original strip across the card
//   strip up to 3 years: the same strip at the one-year size, scrolling sideways
//   rows  longer: one row per calendar year, scrolling up and down
// On the Calendar slide a scrolling layout travels from the first year to today on its own; on the Streak slide it
// opens on the streak. Either way the viewer can scroll it, which holds the Story like holding a slide does.
import { useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { calendarLayout, MONTHS } from '../../lib/story'
import { StoryHold, StoryPaused } from './context'

export const GREENS = ['rgba(255,255,255,0.07)', '#123a2b', '#1b6a44', '#28a565', '#4ff0a0']

const u = (n) => `${n}cqw`
const d = (ms) => ({ '--d': `${ms}ms` })
const DAY_MS = 86_400_000

const GAP = 0.5
const CELL = (82 - GAP * 52) / 53 // 53 weeks across the card: the smallest a square ever gets
const ROW_GAP = 0.45 // a calendar year can touch 54 week columns; a hair less gap fits them at the same square size
const ROW_COLS = 54
const ROWS_VISIBLE = 4
const YEAR_LABEL = 3.4 // height of the year line above each row
const ROW_SPACE = 1.6 // between one year and the next

// the app's ease-in-out, cubic-bezier(0.77, 0, 0.175, 1), for the scripted travel
function easeInOut(t) {
  const [x1, y1, x2, y2] = [0.77, 0, 0.175, 1]
  const bez = (p, a, b) => 3 * (1 - p) ** 2 * p * a + 3 * (1 - p) * p ** 2 * b + p ** 3
  let lo = 0
  let hi = 1
  let p = t
  for (let k = 0; k < 24; k++) {
    if (bez(p, x1, x2) < t) lo = p
    else hi = p
    p = (lo + hi) / 2
  }
  return bez(p, y1, y2)
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const inRange = (range, t) => !!range && t >= range[0] && t <= range[1]

function Cell({ c, cell, range, sweep }) {
  const on = !!c && inRange(range, c.t)
  const dim = !!range
  const style = {
    width: u(cell),
    height: u(cell),
    borderRadius: u(cell * 0.18),
    background: !c || c.out ? 'transparent' : on ? GREENS[4] : GREENS[c.level],
    opacity: !c || c.out ? 0 : dim && !on ? 0.28 : 1,
    boxShadow: on ? `0 0 ${u(2.4)} rgba(79,240,160,0.55)` : undefined,
  }
  if (sweep != null) Object.assign(style, d(sweep))
  return <span className={sweep != null ? 'story-cell' : undefined} style={style} />
}

/** A few weeks: a calendar page like the Best month slide, in greens, so a young repo's days read as dates. */
function MonthGrid({ cal, range }) {
  const days = cal.weeks.flat()
  const inside = days.filter((c) => !c.out)
  const first = new Date(inside[0].t)
  const last = new Date(inside[inside.length - 1].t)
  const sameMonth = first.getUTCMonth() === last.getUTCMonth() && first.getUTCFullYear() === last.getUTCFullYear()
  const title = sameMonth
    ? `${MONTHS[first.getUTCMonth()]} ${first.getUTCFullYear()}`
    : `${MONTHS[first.getUTCMonth()]} – ${MONTHS[last.getUTCMonth()]} ${last.getUTCFullYear()}`
  return (
    <div>
      <div className="story-rise font-mono opacity-70" style={{ ...d(450), fontSize: u(3.2), marginBottom: u(2.4) }}>{title}</div>
      <div className="grid grid-cols-7" style={{ gap: u(1.4) }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
          <span key={i} className="story-rise text-center font-mono opacity-60" style={{ ...d(500), fontSize: u(3) }}>{w}</span>
        ))}
        {days.map((c, i) => {
          if (c.out) return <span key={c.t} />
          const on = inRange(range, c.t)
          return (
            <span
              key={c.t}
              className="story-cell grid aspect-square place-items-center font-mono font-bold tabular-nums"
              style={{
                ...d(600 + i * 22),
                borderRadius: u(1.4),
                fontSize: u(3.2),
                background: on ? GREENS[4] : GREENS[c.level],
                color: on || c.level >= 3 ? '#04140b' : 'rgba(234,255,243,0.6)',
                opacity: range && !on ? 0.28 : 1,
                boxShadow: on ? `0 0 ${u(2.4)} rgba(79,240,160,0.55)` : undefined,
              }}
            >
              {new Date(c.t).getUTCDate()}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Up to a year: the strip exactly as it has always been, sweeping in column by column. */
function FitGrid({ cal, delay, range }) {
  const cols = cal.weeks.length
  const gap = cols > 22 ? 0.5 : 0.8
  const cell = Math.min(7, (82 - gap * (cols - 1)) / cols)
  const step = Math.min(30, 600 / cols) // the sweep lands within ~600ms, however long the history
  // month labels, minus any that would sit on top of the next one (as GitHub does)
  const starts = []
  cal.weeks.forEach((w, i) => {
    const m = new Date(w[0].t).getUTCMonth()
    if (!starts.length || starts[starts.length - 1].m !== m) starts.push({ i, m })
  })
  const labels = starts.filter((x, k) => (!starts[k + 1] || starts[k + 1].i - x.i >= 3) && x.i <= cols - 3)
  return (
    <div className="flex flex-col" style={{ gap: u(1.2) }}>
      <div className="relative" style={{ height: u(3.6), width: u(cols * (cell + gap)) }}>
        {labels.map(({ i, m }) => (
          <span key={i} className="story-rise absolute top-0 font-mono opacity-60" style={{ ...d(delay + i * step), left: u(i * (cell + gap)), fontSize: u(2.8) }}>
            {MONTHS[m]}
          </span>
        ))}
      </div>
      <div className="grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${u(cell)})`, gridAutoColumns: u(cell), gap: u(gap) }}>
        {cal.weeks.flatMap((w, i) => w.map((c) => <Cell key={c.t} c={c} cell={cell} range={range} sweep={delay + i * step} />))}
      </div>
    </div>
  )
}

/**
 * Scrolls a calendar that doesn't fit: places it on mount, travels on its own when asked, and hands over to the
 * viewer on any touch, drag, wheel or arrow key. The Story holds while they explore.
 */
function useExplore(ref, { axis, travel, startAt, endAt, travelMs }) {
  const paused = useContext(StoryPaused)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const hold = useContext(StoryHold)
  const auto = useRef(0)
  const fades = useRef([null, null])

  const pos = (el) => (axis === 'x' ? el.scrollLeft : el.scrollTop)
  const setPos = (el, v) => {
    if (axis === 'x') el.scrollLeft = v
    else el.scrollTop = v
  }
  const max = (el) => (axis === 'x' ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight)
  const stopAuto = () => {
    cancelAnimationFrame(auto.current)
    auto.current = 0
  }

  // edge fades appear only on a side where more history continues
  const syncFades = () => {
    const el = ref.current
    const [a, b] = fades.current
    if (!el || !a || !b) return
    a.style.opacity = pos(el) > 2 ? 1 : 0
    b.style.opacity = pos(el) < max(el) - 2 ? 1 : 0
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const still = reducedMotion()
    setPos(el, travel && !still ? 0 : startAt(el))
    syncFades()
    if (!travel || still) return
    // after the squares sweep in, travel to today; time only counts while the Story plays
    let elapsed = -1300
    let prev = performance.now()
    const from = pos(el)
    const tick = (now) => {
      if (!pausedRef.current) elapsed += now - prev
      prev = now
      const t = Math.min(1, Math.max(0, elapsed / travelMs))
      setPos(el, from + (endAt(el) - from) * easeInOut(t))
      auto.current = t < 1 ? requestAnimationFrame(tick) : 0
    }
    auto.current = requestAnimationFrame(tick)
    return stopAuto
    // placement runs once per slide; the inputs are fixed for its lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // a plain mouse wheel scrolls the sideways strip sideways; wheel gestures hold the Story for a moment
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer = 0
    const onWheel = (e) => {
      if (max(el) <= 0) return // nothing to scroll: leave the wheel alone
      stopAuto()
      if (axis === 'x' && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
      if (!timer) hold(true)
      clearTimeout(timer)
      timer = setTimeout(() => {
        timer = 0
        hold(false)
      }, 700)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (timer) {
        clearTimeout(timer)
        hold(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axis, hold])

  const onPointerDown = (e) => {
    e.stopPropagation() // a press here explores the calendar; it must not count as a tap to the next slide
    stopAuto()
    hold(true)
    const el = e.currentTarget
    if (e.pointerType !== 'mouse') {
      // touch scrolls natively, with momentum; only the hold needs ending
      const up = () => {
        hold(false)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      return
    }
    // a mouse drags the calendar, which a native scroller doesn't do on its own
    el.setPointerCapture(e.pointerId)
    el.style.cursor = 'grabbing'
    let last = axis === 'x' ? e.clientX : e.clientY
    const move = (ev) => {
      const now = axis === 'x' ? ev.clientX : ev.clientY
      setPos(el, pos(el) - (now - last))
      last = now
    }
    const up = () => {
      el.style.cursor = ''
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      hold(false)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  const onPointerUp = (e) => e.stopPropagation()

  const onKeyDown = (e) => {
    const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
    const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown'
    if (e.key !== back && e.key !== forward) return
    // while the calendar has focus, these arrows scroll it instead of changing slides
    e.stopPropagation()
    e.preventDefault()
    stopAuto()
    const el = e.currentTarget
    const by = (axis === 'x' ? el.clientWidth : el.clientHeight) * 0.5 * (e.key === forward ? 1 : -1)
    el.scrollBy(axis === 'x' ? { left: by, behavior: reducedMotion() ? 'auto' : 'smooth' } : { top: by, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  return { onPointerDown, onPointerUp, onKeyDown, onScroll: syncFades, fades }
}

const fadeStyle = (side, bg) => {
  const dir = { left: 'to right', right: 'to left', top: 'to bottom', bottom: 'to top' }[side]
  const box = side === 'left' || side === 'right' ? { top: 0, bottom: 0, [side]: 0, width: u(7) } : { left: 0, right: 0, [side]: 0, height: u(6) }
  return { position: 'absolute', pointerEvents: 'none', opacity: 0, transition: 'opacity 150ms ease', background: `linear-gradient(${dir}, ${bg}, transparent)`, ...box }
}
const scrollerClass = 'outline-none focus-visible:ring-2 focus-visible:ring-[#4ff0a0] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/** Up to 3 years: the same strip at the one-year square size, wider than the card, scrolling sideways. */
function StripGrid({ cal, delay, range, travel, bg }) {
  const ref = useRef(null)
  const cols = cal.weeks.length
  const unit = CELL + GAP
  const width = cols * unit - GAP
  const visible = 53

  // where it opens: the start when it will travel, the streak in the middle, otherwise today
  const colOf = (t) => Math.max(0, cal.weeks.findIndex((w) => w[6].t >= t))
  const firstCol = travel ? 0 : range ? Math.min(cols - visible, Math.max(0, Math.round((colOf(range[0]) + colOf(range[1])) / 2 - visible / 2))) : cols - visible
  const toPx = (el, cqw) => (cqw * el.clientWidth) / 82
  const explore = useExplore(ref, {
    axis: 'x',
    travel,
    startAt: (el) => toPx(el, firstCol * unit),
    endAt: (el) => el.scrollWidth - el.clientWidth,
    travelMs: Math.min(3400, 1100 + (cal.spanDays / 365) * 150),
  })

  // month labels; a January shows its year so you can tell where you are while it moves
  const labels = useMemo(() => {
    const starts = []
    cal.weeks.forEach((w, i) => {
      const day = new Date((w.find((c) => !c.out) || w[0]).t)
      const m = day.getUTCMonth()
      if (!starts.length || starts[starts.length - 1].m !== m) starts.push({ i, m, y: day.getUTCFullYear() })
    })
    const kept = []
    for (const x of starts) {
      if (x.i > cols - 3) break
      const last = kept[kept.length - 1]
      if (last && x.i - last.i < (last.m === 0 ? 6 : 3)) {
        if (x.m === 0 && last.m !== 0) kept[kept.length - 1] = x // a year wins over the month before it
        continue
      }
      kept.push(x)
    }
    return kept
  }, [cal, cols])

  const r0 = range?.[0]
  const r1 = range?.[1]
  const cells = useMemo(() => {
    const step = Math.min(30, 600 / visible)
    const sweepAt = (i) => (i >= firstCol && i < firstCol + visible ? delay + (i - firstCol) * step : null)
    const rng = r0 == null ? null : [r0, r1]
    return cal.weeks.flatMap((w, i) => w.map((c) => <Cell key={c.t} c={c} cell={CELL} range={rng} sweep={sweepAt(i)} />))
  }, [cal, delay, firstCol, r0, r1])
  return (
    <div className="relative" style={{ width: u(82) }}>
      <div
        ref={ref}
        tabIndex={0}
        role="region"
        aria-label={`Contribution calendar, ${new Date(cal.weeks[0][6].t).getUTCFullYear()} to ${new Date(cal.weeks[cols - 1][0].t).getUTCFullYear()}. Scroll for other months.`}
        className={`cursor-grab overflow-x-auto overscroll-x-contain ${scrollerClass}`}
        style={{ touchAction: 'pan-x' }}
        onPointerDown={explore.onPointerDown}
        onPointerUp={explore.onPointerUp}
        onKeyDown={explore.onKeyDown}
        onScroll={explore.onScroll}
      >
        <div className="flex flex-col" style={{ gap: u(1.2), width: u(width) }}>
          <div className="relative" style={{ height: u(3.6) }}>
            {labels.map(({ i, m, y }) => (
              <span key={i} className={`absolute top-0 font-mono ${m === 0 ? 'font-medium opacity-95' : 'opacity-60'}`} style={{ left: u(i * unit), fontSize: u(2.8) }}>
                {m === 0 ? y : MONTHS[m]}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${u(CELL)})`, gridAutoColumns: u(CELL), gap: u(GAP) }}>
            {cells}
          </div>
        </div>
      </div>
      <div ref={(el) => (explore.fades.current[0] = el)} style={fadeStyle('left', bg)} />
      <div ref={(el) => (explore.fades.current[1] = el)} style={fadeStyle('right', bg)} />
    </div>
  )
}

/** Longer: one row per calendar year, the year above it, scrolling from the first year down to today. */
function RowsGrid({ cal, delay, range, travel, bg }) {
  const ref = useRef(null)
  const { years, byDay } = useMemo(() => {
    const byDay = new Map()
    for (const w of cal.weeks) for (const c of w) if (!c.out) byDay.set(c.t, c)
    const days = [...byDay.keys()]
    const y0 = new Date(Math.min(...days.slice(0, 7))).getUTCFullYear()
    const y1 = new Date(Math.max(...days.slice(-7))).getUTCFullYear()
    return { years: Array.from({ length: y1 - y0 + 1 }, (_, k) => y0 + k), byDay }
  }, [cal])

  const rowH = 7 * CELL + 6 * ROW_GAP
  const blockH = YEAR_LABEL + rowH
  const windowH = ROWS_VISIBLE * blockH + (ROWS_VISIBLE - 1) * ROW_SPACE
  const scrolls = years.length > ROWS_VISIBLE
  const focusYear = range ? new Date(range[0]).getUTCFullYear() : null
  const yearIndex = focusYear == null ? years.length - 1 : years.indexOf(focusYear)
  const firstRow = travel ? 0 : Math.min(Math.max(0, years.length - ROWS_VISIBLE), Math.max(0, focusYear == null ? years.length : yearIndex - 1))
  const explore = useExplore(ref, {
    axis: 'y',
    travel: travel && scrolls,
    startAt: (el) => {
      if (focusYear == null) return el.scrollHeight - el.clientHeight
      const row = el.querySelector(`[data-year="${focusYear}"]`)
      return row ? row.offsetTop - (el.clientHeight - row.offsetHeight) / 2 : 0
    },
    endAt: (el) => el.scrollHeight - el.clientHeight,
    travelMs: Math.min(2500, 900 + years.length * 90), // a row is a whole year, so even decades land in ~2.5s
  })

  // month names once over the columns, placed for the latest year (other years differ by at most a column)
  const last = years[years.length - 1]
  const lastStart = Date.UTC(last, 0, 1) - new Date(Date.UTC(last, 0, 1)).getUTCDay() * DAY_MS
  const step = 600 / ROW_COLS
  const r0 = range?.[0]
  const r1 = range?.[1]
  const rows = useMemo(() => {
    const rng = r0 == null ? null : [r0, r1]
    return years.map((y, r) => {
      const start = Date.UTC(y, 0, 1) - new Date(Date.UTC(y, 0, 1)).getUTCDay() * DAY_MS
      const sweeping = r >= firstRow && r < firstRow + ROWS_VISIBLE
      return (
        <div key={y} data-year={y} style={{ marginTop: r ? u(ROW_SPACE) : 0 }}>
          <div className="font-mono opacity-60" style={{ height: u(YEAR_LABEL), fontSize: u(2.6), fontWeight: y === focusYear ? 600 : undefined, opacity: y === focusYear ? 0.95 : undefined }}>
            {y}
          </div>
          <div className="grid grid-flow-col" style={{ gridTemplateRows: `repeat(7, ${u(CELL)})`, gridAutoColumns: u(CELL), gap: u(ROW_GAP) }}>
            {Array.from({ length: ROW_COLS * 7 }, (_, k) => {
              const t = start + k * DAY_MS
              const c = new Date(t).getUTCFullYear() === y ? byDay.get(t) : null
              const col = Math.floor(k / 7)
              return <Cell key={t} c={c} cell={CELL} range={rng} sweep={c && sweeping ? delay + col * step : null} />
            })}
          </div>
        </div>
      )
    })
  }, [years, byDay, delay, firstRow, focusYear, r0, r1, step])
  return (
    <div style={{ width: u(82) }}>
      <div className="relative" style={{ height: u(3.6), marginBottom: u(0.6) }}>
        {MONTHS.map((m, k) => (
          <span key={m} className="absolute top-0 font-mono opacity-60" style={{ left: u(Math.floor((Date.UTC(last, k, 1) - lastStart) / (7 * DAY_MS)) * (CELL + ROW_GAP)), fontSize: u(2.6) }}>
            {m}
          </span>
        ))}
      </div>
      <div className="relative">
        <div
          ref={ref}
          tabIndex={scrolls ? 0 : undefined}
          role={scrolls ? 'region' : undefined}
          aria-label={scrolls ? `Contribution calendar, ${years[0]} to ${last}, one row per year. Scroll for other years.` : undefined}
          className={scrolls ? `cursor-grab overflow-y-auto overscroll-y-contain ${scrollerClass}` : 'overflow-hidden'}
          style={{ height: u(windowH), touchAction: scrolls ? 'pan-y' : undefined }}
          onPointerDown={scrolls ? explore.onPointerDown : undefined}
          onPointerUp={scrolls ? explore.onPointerUp : undefined}
          onKeyDown={scrolls ? explore.onKeyDown : undefined}
          onScroll={explore.onScroll}
        >
          {rows}
        </div>
        <div ref={(el) => (explore.fades.current[0] = el)} style={fadeStyle('top', bg)} />
        <div ref={(el) => (explore.fades.current[1] = el)} style={fadeStyle('bottom', bg)} />
      </div>
    </div>
  )
}

/**
 * The calendar for a slide. `travel`: a scrolling layout moves from the first year to today on its own (Calendar
 * slide). `highlight` ({ from, to } days): those days glow, the rest dim, and a scrolling layout opens on them
 * (Streak slide). `bg`: the slide's color, for the edge fades.
 *
 * The squares are drawn once per slide: pausing the Story re-renders the slide, and decades of history are over
 * ten thousand squares, so they are memoized on the inputs that actually change them.
 */
export default function CalendarGrid({ cal, delay = 500, highlight = null, travel = false, bg = '#07120d' }) {
  const layout = calendarLayout(cal)
  const range = highlight ? [highlight.from, highlight.to] : null
  if (layout === 'month') return <MonthGrid cal={cal} range={range} />
  if (layout === 'fit') return <FitGrid cal={cal} delay={delay} range={range} />
  const props = { cal, delay, range, travel, bg }
  return layout === 'strip' ? <StripGrid {...props} /> : <RowsGrid {...props} />
}
