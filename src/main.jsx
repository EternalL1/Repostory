import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bundled fonts (GitHub's open-source Mona Sans + Monaspace Neon, OFL): same look on every OS, served locally
import '@fontsource-variable/mona-sans'
import '@fontsource/monaspace-neon/400.css'
import '@fontsource/monaspace-neon/500.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
