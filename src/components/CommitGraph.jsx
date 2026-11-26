import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatDate, shortHash } from '../lib/git'
import { COL, laneColor } from '../lib/theme'
import { Badge, RefChip } from './ui'

const ROW = 36 // px, matches h-9
const LANE = 18
const PAD = 14
const OVERSCAN = 15 // rows drawn beyond each edge of the view, so a fast scroll never shows a gap
const WINDOW_FROM = 200 // smaller histories draw every row, exactly as before

/** Width of the lane area for a model, so headers can line up with the rows. */
export const graphWidth = (model) => PAD * 2 + LANE * model.laneCount

/** The element that scrolls this one: the nearest ancestor that scrolls vertically, else the page. */
function scrollParent(el) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}

/** The part of the scroll area that is visible, in viewport coordinates. */
const viewport = (scroller) => (scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight, height: window.innerHeight })

/**
 * Which rows are on screen (plus a margin). Long histories draw only those, so tens of thousands of commits scroll
 * like a few dozen; the full height is kept, so the scrollbar and positions are unchanged.
 */
function useVisibleRows(rootRef, count) {
  const windowed = count > WINDOW_FROM
  const [range, setRange] = useState(() => [0, windowed ? Math.min(count, 60) : count])

  useLayoutEffect(() => {
    if (!windowed) {
      setRange([0, count])
      return
    }
    const root = rootRef.current
    const scroller = scrollParent(root)
    let raf = 0
    const measure = () => {
      raf = 0
      const top = root.getBoundingClientRect().top
      const view = viewport(scroller)
      const start = Math.max(0, Math.floor((view.top - top) / ROW) - OVERSCAN)
      const end = Math.min(count, Math.ceil((view.bottom - top) / ROW) + OVERSCAN)
      setRange((r) => (r[0] === start && r[1] === end ? r : [start, end]))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    const target = scroller || window
    target.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const ro = new ResizeObserver(schedule)
    if (scroller) ro.observe(scroller)
    return () => {
      cancelAnimationFrame(raf)
      target.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
    }
  }, [rootRef, count, windowed])

  return range
}

/**
 * Draws the commit DAG: an SVG of lanes behind full-width clickable rows.
 *
 * mode:       'normal' | 'compare' | 'longest'
 * comparison: result of compareCommits() (compare mode)
 * highlight:  Set of hashes to keep bright in normal mode (search / branch filter); others fade
 * focus:      { hash, instant? } — scrolls that row into view whenever the object changes
 * compact:    number of rows to show, with hash + refs + message only (previews)
 */
export default function CommitGraph({ model, selected, onSelect, mode = 'normal', comparison = null, highlight = null, focus = null, compact = 0 }) {
  const rootRef = useRef(null)
  const { commits } = model
  const order = compact ? model.order.slice(0, compact) : model.order
  const [start, end] = useVisibleRows(rootRef, order.length)

  // scroll a row into view by position, so it works even when the row isn't drawn yet
  useEffect(() => {
    if (!focus) return
    const c = commits.get(focus.hash)
    const root = rootRef.current
    if (!c || !root || c.row >= order.length) return
    const scroller = scrollParent(root)
    const view = viewport(scroller)
    const rowTop = root.getBoundingClientRect().top + c.row * ROW
    const by = (top, behavior = 'auto') => (scroller ? scroller.scrollBy({ top, behavior }) : window.scrollBy({ top, behavior }))
    // the Graph tab keeps a sticky column header above the rows
    const inset = scroller && scroller.firstElementChild !== root ? scroller.firstElementChild.offsetHeight : 0
    if (focus.instant) {
      // keyboard moves jump to the nearest edge (never animate keyboard actions)
      if (rowTop < view.top + inset) by(rowTop - view.top - inset)
      else if (rowTop + ROW > view.bottom) by(rowTop + ROW - view.bottom)
    } else {
      // clicks elsewhere glide the row to the middle
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      by(rowTop - (view.top + inset + (view.height - inset) / 2 - ROW / 2), reduce ? 'auto' : 'smooth')
    }
  }, [focus, commits, order.length])

  // status is worked out per commit on demand and remembered until the inputs change
  const statusOf = useMemo(() => {
    const cache = new Map()
    const compute = (c) => {
      if (mode === 'compare' && comparison) {
        if (comparison.mergeBases.includes(c.hash)) return { color: COL.mergeBase, dim: false, kind: 'base' }
        const inA = comparison.aSet.has(c.hash)
        const inB = comparison.bSet.has(c.hash)
        if (inA && inB) return { color: COL.shared, dim: false, kind: 'shared' }
        if (inA) return { color: COL.a, dim: false, kind: 'a' }
        if (inB) return { color: COL.b, dim: false, kind: 'b' }
        return { color: COL.faded, dim: true, kind: 'none' }
      }
      if (mode === 'longest') {
        return model.longest.set.has(c.hash) ? { color: COL.path, dim: false } : { color: COL.faded, dim: true }
      }
      const dim = highlight ? !highlight.has(c.hash) : false
      return { color: dim ? COL.faded : laneColor(c.lane), dim }
    }
    return (c) => {
      let s = cache.get(c.hash)
      if (!s) cache.set(c.hash, (s = compute(c)))
      return s
    }
  }, [model, mode, comparison, highlight])

  const width = graphWidth(model)
  const height = order.length * ROW
  const x = (lane) => PAD + lane * LANE + LANE / 2
  const y = (row) => row * ROW + ROW / 2

  const edges = []
  const nodes = []
  const visible = order.slice(start, end)

  // edges that cross the drawn rows: a parent link can start far above them and end far below
  for (let i = 0; i < end; i++) {
    const c = order[i]
    c.parents.forEach((p, k) => {
      const parent = commits.get(p)
      if (parent.row < start) return
      const via = c.edgeLanes[k]
      const x1 = x(c.lane), y1 = y(c.row), xv = x(via), x2 = x(parent.lane), y2 = y(parent.row)
      let d
      if (parent.row - c.row === 1) {
        d = `M${x1} ${y1} C${x1} ${y1 + ROW * 0.6} ${x2} ${y2 - ROW * 0.6} ${x2} ${y2}`
      } else {
        d = `M${x1} ${y1}` + (x1 === xv ? ` L${xv} ${y1 + ROW}` : ` C${x1} ${y1 + ROW * 0.6} ${xv} ${y1 + ROW * 0.4} ${xv} ${y1 + ROW}`)
        d += ` L${xv} ${y2 - ROW}` + (xv === x2 ? ` L${x2} ${y2}` : ` C${xv} ${y2 - ROW * 0.6} ${x2} ${y2 - ROW * 0.4} ${x2} ${y2}`)
      }

      let color = laneColor(via)
      let strokeWidth = 2
      let opacity = 1
      const sc = statusOf(c)
      const sp = statusOf(parent)
      if (mode === 'compare' && comparison) {
        color = sc.dim ? COL.faded : sc.kind === sp.kind || sp.kind === 'base' ? sc.color : COL.shared
        if (sc.dim) opacity = 0.35
      } else if (mode === 'longest') {
        if (model.longest.edges.has(`${c.hash}>${p}`)) {
          color = COL.path
          strokeWidth = 3
        } else {
          color = COL.faded
        }
      } else if (sc.dim || sp.dim) {
        color = COL.faded
      }
      edges.push(<path key={`${c.hash}-${p}`} d={d} style={{ stroke: color }} strokeWidth={strokeWidth} fill="none" opacity={opacity} />)
    })
  }

  for (const c of visible) {
    const s = statusOf(c)
    const cx = x(c.lane)
    const cy = y(c.row)
    const isMerge = c.parents.length > 1
    if (mode === 'compare' && s.kind === 'base') {
      nodes.push(<circle key={`${c.hash}-base`} cx={cx} cy={cy} r="10" fill="none" style={{ stroke: COL.mergeBase }} strokeWidth="1.5" strokeDasharray="3 2" />)
    }
    if (selected === c.hash) {
      nodes.push(<circle key={`${c.hash}-sel`} cx={cx} cy={cy} r="9" fill="none" style={{ stroke: s.color }} strokeWidth="1.5" opacity="0.6" />)
    }
    nodes.push(
      <circle
        key={c.hash}
        cx={cx}
        cy={cy}
        r={isMerge ? 4.5 : 5}
        style={{ fill: isMerge ? COL.panel : s.color, stroke: isMerge ? s.color : 'none' }}
        strokeWidth={isMerge ? 2.2 : 0}
      />,
    )
  }

  const hashColor = (s) => (s.kind === 'a' ? COL.a : s.kind === 'b' ? COL.b : s.kind === 'base' ? COL.mergeBase : COL.muted)

  return (
    <div ref={rootRef} className="relative" style={compact ? { height } : { minWidth: 640, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="pointer-events-none absolute left-0 top-0 z-[1] block"
        aria-hidden="true"
      >
        {edges}
        {nodes}
      </svg>
      {visible.map((c) => {
        const s = statusOf(c)
        const isSelected = selected === c.hash
        return (
          <button
            key={c.hash}
            type="button"
            onClick={() => onSelect?.(c.hash)}
            aria-pressed={onSelect ? isSelected : undefined}
            aria-label={`${shortHash(c.hash)} ${c.subject}`}
            tabIndex={onSelect ? 0 : -1}
            style={{
              position: 'absolute',
              top: c.row * ROW,
              left: 0,
              paddingLeft: width,
              boxShadow: isSelected ? `inset 2px 0 0 ${s.color}` : undefined,
            }}
            className={`flex h-9 w-full cursor-pointer items-center gap-3 pr-4 text-left transition-[background-color] duration-150 focus-visible:-outline-offset-2 ${
              isSelected ? 'bg-accent/[0.09]' : 'hover:bg-fg/[0.045]'
            }`}
          >
            <span className={`flex min-w-0 flex-1 items-center gap-3 ${s.dim ? 'opacity-35' : ''}`}>
              <span className="w-[60px] flex-none font-mono text-xs" style={{ color: hashColor(s) }}>
                {shortHash(c.hash)}
              </span>
              {mode === 'compare' && s.kind === 'base' && <Badge color={COL.mergeBase} solid>merge-base</Badge>}
              {c.refs.map((r) => (
                <RefChip key={r.type + r.name} refInfo={r} lane={c.lane} />
              ))}
              <span className={`min-w-0 flex-1 truncate text-sm ${mode === 'compare' && s.kind === 'shared' ? 'text-soft' : 'text-fg'}`}>
                {c.subject}
              </span>
              {!compact && (
                <>
                  <span className="w-[104px] flex-none truncate text-xs text-muted max-md:hidden">{c.author}</span>
                  <span className="w-[48px] flex-none text-right text-xs text-muted">{formatDate(c.date)}</span>
                </>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
