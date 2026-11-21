import { useEffect, useRef } from 'react'
import { formatDate, shortHash } from '../lib/git.js'
import { COL, laneColor } from '../lib/theme.js'
import { RefChip } from './ui.jsx'

const ROW = 36 // px, matches h-9
const LANE = 20
const PAD = 16

/**
 * Draws the commit DAG (SVG lanes + clickable rows).
 *
 * mode:       'normal' | 'compare' | 'longest'
 * comparison: result of compareCommits() (compare mode)
 * highlight:  Set of hashes to keep bright in normal mode (search / branch filter); others fade
 * focus:      { hash } — scrolls that row into view whenever the object changes
 */
export default function CommitGraph({ model, selected, onSelect, mode = 'normal', comparison = null, highlight = null, focus = null }) {
  const rowRefs = useRef(new Map())

  useEffect(() => {
    if (!focus) return
    rowRefs.current.get(focus.hash)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
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

  const { order, commits, laneCount } = model
  const width = PAD * 2 + LANE * laneCount
  const height = order.length * ROW
  const x = (lane) => PAD + lane * LANE + LANE / 2
  const y = (row) => row * ROW + ROW / 2

  const edges = []
  const nodes = []
  const status = new Map(order.map((c) => [c.hash, statusOf(c)]))

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
          strokeWidth = 3.5
        } else {
          color = COL.faded
          opacity = 0.5
        }
      } else if (sc.dim || sp.dim) {
        color = COL.faded
        opacity = 0.5
      }
      edges.push(<path key={`${c.hash}-${p}`} d={d} stroke={color} strokeWidth={strokeWidth} fill="none" opacity={opacity} />)
    })
  }

  for (const c of order) {
    const s = status.get(c.hash)
    const cx = x(c.lane)
    const cy = y(c.row)
    const isMerge = c.parents.length > 1
    if (mode === 'compare' && s.kind === 'base') {
      nodes.push(<circle key={`${c.hash}-base`} cx={cx} cy={cy} r="11" fill="none" stroke={COL.mergeBase} strokeWidth="1.5" strokeDasharray="3 2" />)
    }
    if (selected === c.hash) {
      nodes.push(<circle key={`${c.hash}-sel`} cx={cx} cy={cy} r="10" fill="none" stroke="#fff" strokeWidth="1.5" />)
    }
    nodes.push(
      <circle
        key={c.hash}
        cx={cx}
        cy={cy}
        r={isMerge ? 5.5 : 6}
        fill={isMerge ? COL.panel : s.color}
        stroke={isMerge ? s.color : 'none'}
        strokeWidth={isMerge ? 2.6 : 0}
        opacity={s.dim ? 0.45 : 1}
        className="cursor-pointer"
        onClick={() => onSelect?.(c.hash)}
      />,
    )
  }

  const hashColor = (s) =>
    s.kind === 'a' ? COL.a : s.kind === 'b' ? COL.b : s.kind === 'base' ? COL.mergeBase : COL.muted

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px] py-1">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block flex-none" aria-hidden="true">
          {edges}
          {nodes}
        </svg>
        <div className="min-w-0 flex-1">
          {order.map((c) => {
            const s = status.get(c.hash)
            const isSelected = selected === c.hash
            return (
              <button
                key={c.hash}
                type="button"
                ref={(el) => (el ? rowRefs.current.set(c.hash, el) : rowRefs.current.delete(c.hash))}
                onClick={() => onSelect?.(c.hash)}
                aria-pressed={isSelected}
                className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md pr-4 text-left transition-colors hover:bg-white/5 ${
                  isSelected ? 'bg-accent/15' : ''
                } ${s.dim ? 'opacity-40' : ''}`}
              >
                <span className="w-16 flex-none font-mono text-xs" style={{ color: hashColor(s) }}>
                  {shortHash(c.hash)}
                </span>
                {mode === 'compare' && s.kind === 'base' && (
                  <span className="flex-none rounded-full bg-merge-base px-2 text-[11px] font-bold leading-[18px] text-[#1a1a1a]">
                    merge-base
                  </span>
                )}
                {c.refs.map((r) => (
                  <RefChip key={r.type + r.name} refInfo={r} lane={c.lane} />
                ))}
                <span className={`min-w-0 flex-1 truncate ${mode === 'compare' && s.kind === 'shared' ? 'text-soft' : ''}`}>
                  {c.subject}
                </span>
                <span className="w-[100px] flex-none truncate text-xs text-muted">{c.author}</span>
                <span className="w-[52px] flex-none text-right text-xs text-muted">{formatDate(c.date)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
