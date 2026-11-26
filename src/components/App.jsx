'use client'

import { useEffect, useState } from 'react'
import Header from './Header'
import { buildModel, defaultComparison } from '../lib/git'
import { SAMPLES } from '../lib/samples'
import ComparePage from '../tabs/ComparePage'
import GraphPage from '../tabs/GraphPage'
import LoadPage from '../tabs/LoadPage'
import StoryPage from '../tabs/StoryPage'
import TeamPage from '../tabs/TeamPage'

// keys keep the app's earlier name on purpose: renaming them would wipe every visitor's saved repo and theme
const STORAGE_KEY = 'repograph.lastRepo'
const DEFAULT_SAMPLE = 'storefront'

const sampleModel = (id) => {
  const s = SAMPLES.find((x) => x.id === id) || SAMPLES.find((x) => x.id === DEFAULT_SAMPLE)
  return buildModel(s.text(), s.name)
}

function initialModel() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved?.text) return buildModel(saved.text, saved.name)
    if (saved?.sample) return sampleModel(saved.sample)
  } catch {
    /* fall back to the default sample */
  }
  return sampleModel(DEFAULT_SAMPLE)
}

/** The whole Repostory app: tabs, the loaded repository, and every page. */
export default function App() {
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

  const loadSample = (id) => {
    try {
      // remember the pick (small), not the generated text
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sample: id }))
    } catch {
      /* ignore */
    }
    applyModel(sampleModel(id))
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
      {tab === 'story' && <StoryPage model={model} />}
    </div>
  )
}
