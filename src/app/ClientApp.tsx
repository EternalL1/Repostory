'use client'

import dynamic from 'next/dynamic'

// The app reads localStorage, window size and the clipboard from its first render, so it runs in the browser only
const App = dynamic(() => import('../components/App'), { ssr: false })

export default function ClientApp() {
  return <App />
}
