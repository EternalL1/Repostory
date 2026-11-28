import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
// Bundled fonts (GitHub's open-source Mona Sans + Monaspace Neon, OFL): same look on every OS, served locally
import '@fontsource-variable/mona-sans'
import '@fontsource/monaspace-neon/400.css'
import '@fontsource/monaspace-neon/500.css'
// bold mono is used by the When clock, the coder card and the calendar's dates: real weights, not faux bold
import '@fontsource/monaspace-neon/700.css'
import '@fontsource/monaspace-neon/800.css'
import './globals.css'

// absolute base for share-card URLs: the production domain on Vercel, localhost in development
const site =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:5173')

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: 'Repostory: the story behind your Git history',
  description: 'Paste your git log and see its history as a graph, team insights and a tap-through Story you can share.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0c0f' },
    { media: '(prefers-color-scheme: light)', color: '#f5f6f8' },
  ],
}

// apply a saved theme choice before first paint (no flash of the wrong theme)
const themeScript = `try{const t=localStorage.getItem('repograph.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the theme script sets data-theme before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        {/* Vercel Web Analytics: page views and visitors, no cookies; does nothing until enabled in the Vercel project */}
        <Analytics />
      </body>
    </html>
  )
}
