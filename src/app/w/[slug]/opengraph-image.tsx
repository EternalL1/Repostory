import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { identiconCells, identiconColor, STORY_LANES } from '../../../components/story/art'
import { getShare } from '../../../db/shares'
import { fmt } from '../../../lib/story'

// The link-preview card for a shared Story, in the poster's palette (see lib/storyImage.ts)
export const alt = 'A Repostory Story'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// cached like the page it previews (see page.tsx)
export const revalidate = 300
export const generateStaticParams = () => []

const BG = '#15171c'
const PANEL = '#0b0d12'
const LIME = '#b8f34a'
const LOGO = ['BBB......', 'BBB......', 'BBB......', '.BPP.....', '.B..PPPPP', '.B....PPP', 'GGG...PPP', 'GGG......', 'GGG......']
const LOGO_COLORS: Record<string, string> = { B: STORY_LANES[0], G: STORY_LANES[1], P: STORY_LANES[2] }

// next/og (Satori) reads TTF, OTF or WOFF only, not the WOFF2 files the app ships. Mona Sans only: Satori can't
// parse Monaspace Neon's contextual alternates (GSUB lookup type 6) and the whole card fails.
const font = (file: string) => readFile(join(process.cwd(), 'src/assets/og-fonts', file))

const Identicon = ({ name, size }: { name: string; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 7 7" shapeRendering="crispEdges">
    <rect width="7" height="7" fill={PANEL} />
    {identiconCells(name).flatMap((row: boolean[], y: number) =>
      row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x + 1} y={y + 1} width="1" height="1" fill={identiconColor(name)} /> : null)),
    )}
  </svg>
)

const Logo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 9 9" shapeRendering="crispEdges">
    {LOGO.flatMap((row, y) => [...row].map((ch, x) => (LOGO_COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={LOGO_COLORS[ch]} /> : null)))}
  </svg>
)

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const [share, mona500, mona700, mona800] = await Promise.all([
    getShare((await params).slug),
    font('mona-sans-latin-500-normal.woff'),
    font('mona-sans-latin-700-normal.woff'),
    font('mona-sans-latin-800-normal.woff'),
  ])
  const fonts = [
    { name: 'Mona Sans', data: mona500, weight: 500 as const },
    { name: 'Mona Sans', data: mona700, weight: 700 as const },
    { name: 'Mona Sans', data: mona800, weight: 800 as const },
  ]
  const stats = share?.stats
  const label = { fontSize: 24, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }
  const top = stats?.top[0]

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: BG, color: '#fff', fontFamily: 'Mona Sans', padding: '56px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, fontWeight: 500 }}>
          <span style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 820, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{stats?.name ?? 'Repostory'}</span>
          <span style={{ color: LIME }}>{stats?.year ?? ''}</span>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          {stats ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={label}>Commits</span>
              <span style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>{fmt(stats.commits)}</span>
              <div style={{ display: 'flex', gap: 56, marginTop: 28 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={label}>Team type</span>
                  <span style={{ fontSize: 44, fontWeight: 800 }}>{stats.persona.name}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={label}>Longest streak</span>
                  <span style={{ fontSize: 44, fontWeight: 800 }}>{stats.streak === 1 ? '1 day' : `${stats.streak} days`}</span>
                </div>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 64, fontWeight: 800 }}>The story behind your Git history</span>
          )}
          {top && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', padding: 12, background: PANEL }}>
                <Identicon name={top.name} size={232} />
              </div>
              <span style={{ ...label, fontSize: 22, maxWidth: 300, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>Top: {top.name}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo size={34} />
            <span style={{ fontSize: 30, fontWeight: 700 }}>Repostory</span>
          </div>
          <span style={{ fontSize: 24, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{stats?.range ?? ''}</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
