import { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import { buildModel, defaultComparison } from './lib/git.js'
import { SAMPLE_NAME, sampleLogText } from './lib/sample.js'
import ComparePage from './pages/ComparePage.jsx'
import GraphPage from './pages/GraphPage.jsx'
import LoadPage from './pages/LoadPage.jsx'
import TeamPage from './pages/TeamPage.jsx'

const STORAGE_KEY = 'repograph.lastRepo'

function initialModel() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved?.text) return buildModel(saved.text, saved.name)
  } catch {
    /* fall back to the sample */
  }
  return buildModel(sampleLogText(), SAMPLE_NAME)
}

/** The whole RepoGraph app. Drop <RepoGraph /> anywhere in a React + Tailwind v4 app. */
export default function RepoGraph() {
  const [model, setModel] = useState(initialModel)
  const [tab, setTab] = useState('load')
  const [selected, setSelected] = useState(null)
  const [comparison, setComparison] = useState(() => defaultComparison(model))
  const [error, setError] = useState('')

  // each tab starts at its top, not wherever the previous tab was scrolled to
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  const applyModel = (next) => {
    setModel(next)
    setSelected(null)
    setComparison(defaultComparison(next))
    setError('')
    setTab('graph')
  }

  const loadText = (text, name) => {
    try {
      const next = buildModel(text, name)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ text, name }))
      } catch {
        /* storage full or unavailable: still works for this session */
      }
      applyModel(next)
    } catch (e) {
      setError(e.message)
    }
  }

  const loadSample = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    applyModel(buildModel(sampleLogText(), SAMPLE_NAME))
  }

  const setCompareSide = (side, hash) => {
    setComparison((c) => ({ ...c, [side]: hash }))
    setTab('compare')
  }

  return (
    <div className="min-h-screen bg-ink font-sans text-sm leading-normal text-fg">
      <Header tab={tab} onTab={setTab} model={model} />
      {tab === 'load' && (
        <LoadPage
          model={model}
          error={error}
          isSample={model.name === SAMPLE_NAME}
          onLoad={loadText}
          onLoadSample={loadSample}
          onOpenGraph={(hash) => {
            if (hash) setSelected(hash)
            setTab('graph')
          }}
        />
      )}
      {tab === 'graph' && <GraphPage model={model} selected={selected} onSelect={setSelected} onSetCompare={setCompareSide} />}
      {tab === 'compare' && <ComparePage model={model} comparison={comparison} onChange={setComparison} />}
      {tab === 'team' && <TeamPage model={model} />}
    </div>
  )
}
