import { useEffect, useRef } from 'react'
import { formatDate, shortHash } from '../lib/git'
import { COL, laneColor } from '../lib/theme'
import { Badge, RefChip } from './ui'

const ROW = 36 // px, matches h-9
const LANE = 18
const PAD = 14

/** Width of the lane area for a model, so headers can line up with the rows. */
export const graphWidth = (model) => PAD * 2 + LANE * model.laneCount

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
  const rowRefs = useRef(new Map())

  useEffect(() => {
    if (!focus) return
    const row = rowRefs.current.get(focus.hash)
    if (!row) return
    // keyboard moves jump (never animate keyboard actions); clicks elsewhere glide to the row
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollIntoView(focus.instant ? { block: 'nearest' } : { block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }, [focus])

  const statusOf = (c) => {
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

  const { commits } = model
  const order = compact ? model.order.slice(0, compact) : model.order
  const width = graphWidth(model)
  const height = order.length * ROW
  const x = (lane) => PAD + lane * LANE + LANE / 2
  const y = (row) => row * ROW + ROW / 2

  const edges = []
  const nodes = []
  const status = new Map(model.order.map((c) => [c.hash, statusOf(c)]))

  for (const c of order) {
    c.parents.forEach((p, k) => {
      const parent = commits.get(p)
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
      const sc = status.get(c.hash)
      const sp = status.get(p)
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

  for (const c of order) {
    const s = status.get(c.hash)
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
    <div className="relative" style={compact ? undefined : { minWidth: 640 }}>
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
      {order.map((c) => {
        const s = status.get(c.hash)
        const isSelected = selected === c.hash
        return (
          <button
            key={c.hash}
            type="button"
            ref={(el) => {
              if (el) rowRefs.current.set(c.hash, el)
              else rowRefs.current.delete(c.hash)
            }}
            onClick={() => onSelect?.(c.hash)}
            aria-pressed={onSelect ? isSelected : undefined}
            aria-label={`${shortHash(c.hash)} ${c.subject}`}
            tabIndex={onSelect ? 0 : -1}
            style={{
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
