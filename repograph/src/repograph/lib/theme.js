// Colors used in SVG and inline styles (dynamic per lane / per author).
export const LANE_COLORS = ['#7c9cff', '#3ddc97', '#ff7eb6', '#f5a524', '#56d4e8', '#c084fc', '#ff6b6b', '#a3e635']
export const laneColor = (lane) => LANE_COLORS[lane % LANE_COLORS.length]

export const COL = {
  a: '#4ea1ff',
  b: '#ff9f43',
  mergeBase: '#f5d547',
  path: '#3ddc97',
  shared: '#5b6577',
  faded: '#3a4252',
  panel: '#161b22',
  muted: '#8b97a7',
}
