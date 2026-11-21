// Colors used in SVG and inline styles (dynamic per lane / per author). Keep in sync with theme.css.
export const LANE_COLORS = ['#5e9eff', '#3ddc97', '#ff7eb6', '#f5a524', '#56d4e8', '#ff6b6b', '#a3e635', '#e8a87c']
export const laneColor = (lane) => LANE_COLORS[lane % LANE_COLORS.length]

export const COL = {
  a: '#4ea1ff',
  b: '#ff9f43',
  mergeBase: '#f5d547',
  path: '#3ddc97',
  shared: '#5b6472',
  faded: '#2e343d',
  panel: '#111418',
  panel2: '#171b21',
  line: '#21262d',
  muted: '#7d8591',
  subtle: '#c5cad1',
  fg: '#eceef1',
  ink: '#0a0c0f',
  accent: '#5e9eff',
  merge: '#ff7eb6',
}
