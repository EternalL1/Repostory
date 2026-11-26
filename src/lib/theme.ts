// Colors used in SVG and inline styles (dynamic per lane / per author).
// They point at CSS variables from theme.css, so they follow the light / dark theme.
// In SVG, pass them through `style` (var() is not reliable in presentation attributes).
export const LANE_COLORS = Array.from({ length: 8 }, (_, i) => `var(--color-lane-${i})`)
export const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length]

export const COL = {
  a: 'var(--color-branch-a)',
  b: 'var(--color-branch-b)',
  mergeBase: 'var(--color-merge-base)',
  path: 'var(--color-path)',
  shared: 'var(--color-shared)',
  faded: 'var(--color-faded)',
  panel: 'var(--color-panel)',
  panel2: 'var(--color-panel-2)',
  line: 'var(--color-line)',
  muted: 'var(--color-muted)',
  subtle: 'var(--color-subtle)',
  fg: 'var(--color-fg)',
  ink: 'var(--color-ink)',
  accent: 'var(--color-accent)',
  merge: 'var(--color-merge)',
}

/** `color` at `percent`% strength over transparent — works with var() colors, unlike hex alpha suffixes. */
export const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`
