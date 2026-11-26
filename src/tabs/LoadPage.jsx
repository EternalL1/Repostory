import { useEffect, useMemo, useRef, useState } from 'react'
import CommitGraph from '../components/CommitGraph'
import { GIT_LOG_COMMAND } from '../lib/git'
import { parseRepoInput } from '../lib/github'
import { SAMPLES } from '../lib/samples'
import { Button, CopyButton, fieldClass } from '../components/ui'
import { PixelClipboard, PixelTerminal } from '../components/pixel'

/** "462 commits · 8 people", read straight from the generated text (cheaper than building each graph). */
function sampleSize(text) {
  const lines = text.split('\n').filter((l) => l.startsWith('@@'))
  const people = new Set(lines.map((l) => l.split('|')[2]))
  return `${lines.length} commits · ${people.size} ${people.size === 1 ? 'person' : 'people'}`
}

const PREVIEW_ROWS = 13

/** Load a public GitHub repository: the server turns it into the same log format as a paste. */
function GitHubLoader({ onLoad }) {
  const [repo, setRepo] = useState('')
  const [state, setState] = useState({ status: 'idle' })
  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])

  const load = async (e) => {
    e.preventDefault()
    const input = repo.trim()
    if (!input) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const parsed = parseRepoInput(input)
    setState({ status: 'loading', label: parsed ? `${parsed.owner}/${parsed.name}` : input })
    try {
      const res = await fetch(`/api/github?repo=${encodeURIComponent(input)}`, { signal: controller.signal })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Loading from GitHub failed. Try again in a moment.')
      setState({ status: 'idle' })
      onLoad(data.text, data.name, { source: 'github', truncated: data.truncated })
    } catch (err) {
      if (err.name === 'AbortError') return
      setState({ status: 'error', message: err.message })
    }
  }

  const loading = state.status === 'loading'
  return (
    <form className="flex flex-col gap-2" onSubmit={load}>
      <h2 className="m-0 text-sm font-medium">
        <label htmlFor="githubRepo">Load a public GitHub repository</label>
      </h2>
      <div className="flex gap-2">
        <input
          id="githubRepo"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="github.com/owner/name"
          autoComplete="off"
          spellCheck={false}
          className={`${fieldClass} min-w-0 flex-1 font-mono text-xs`}
        />
        <Button type="submit" variant="primary" disabled={!repo.trim() || loading}>
          {loading ? 'Loading…' : 'Load'}
        </Button>
      </div>
      <p className="m-0 text-xs text-muted" aria-live="polite">
        {loading ? (
          `Reading ${state.label} from GitHub… big repositories take up to 15 seconds.`
        ) : state.status === 'error' ? (
          <span role="alert" className="text-danger">{state.message}</span>
        ) : (
          'The newest 2,000 commits plus every branch. File stats need the pasted log below.'
        )}
      </p>
    </form>
  )
}

export default function LoadPage({ model, error, onLoad, onLoadSample, onOpenGraph }) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)

  const readFile = async (file) => {
    if (!file) return
    setText(await file.text())
    if (!name) setName(file.name.replace(/\.(txt|log)$/i, ''))
  }

  const lines = text ? text.split('\n').filter((l) => l.startsWith('@@')).length : 0
  const samples = useMemo(() => SAMPLES.map((s) => ({ ...s, size: sampleSize(s.text()) })), [])

  return (
    <main className="mx-auto grid max-w-[1240px] grid-cols-1 gap-x-14 gap-y-12 px-4 pb-16 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-8">
        <div>
          <h1 className="m-0 text-2xl font-semibold leading-tight">See how your repository grew.</h1>
          <p className="m-0 mt-3 text-base leading-relaxed text-soft">
            Load a GitHub repository or paste your history, and read it as a graph: where branches split, how far they drifted, who
            works on what.
          </p>
        </div>

        <GitHubLoader onLoad={onLoad} />

        <div className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          or paste the git log, for private repos and file stats
          <span className="h-px flex-1 bg-line" />
        </div>

        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            onLoad(text, name.trim() || 'my-repo')
          }}
        >
          <div className="flex flex-col gap-2">
            <h2 className="m-0 flex items-center gap-2 text-sm font-medium">
              <PixelTerminal />
              Run this in your repository
            </h2>
            <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-panel py-1 pl-3 pr-1">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1 font-mono text-xs text-subtle">{GIT_LOG_COMMAND}</code>
              <CopyButton text={GIT_LOG_COMMAND} label="Copy command" className="border-transparent bg-transparent" />
            </div>
            <p className="m-0 text-xs text-muted">
              Huge history? Add <code className="font-mono text-soft">-n 50000</code> for the latest 50,000 commits.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="m-0 text-sm font-medium">
              <label htmlFor="logInput">
                <span className="inline-flex items-center gap-2"><PixelClipboard />Paste the output, or drop the file</span>
              </label>
            </h2>
            <div className="relative">
              <textarea
                id="logInput"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onDragEnter={(e) => {
                  e.preventDefault()
                  dragDepth.current++
                  setDragging(true)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => {
                  if (--dragDepth.current <= 0) setDragging(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  dragDepth.current = 0
                  setDragging(false)
                  readFile(e.dataTransfer.files[0])
                }}
                spellCheck={false}
                placeholder="@@d8c7f83…|35a41d6… ae3c4f1…|Dan Lim|2026-10-13T19:10…"
                className={`${fieldClass} block min-h-32 w-full resize-y py-2.5 font-mono text-xs leading-relaxed ${
                  dragging ? 'border-accent bg-accent/5' : ''
                }`}
              />
              {dragging && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-medium text-accent">Drop to load</div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
              <label htmlFor="repoName" className="text-xs text-muted">Name</label>
              <input id="repoName" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-repo" className={`${fieldClass} font-mono text-xs`} />
            </div>
            <label className="press inline-flex min-h-8 cursor-pointer items-center rounded-lg border border-line-strong bg-panel px-3 text-sm font-medium hover:border-line-hover hover:bg-panel-2">
              Open file…
              <input type="file" accept=".txt,.log,text/plain" hidden onChange={(e) => readFile(e.target.files[0])} />
            </label>
            <Button type="submit" variant="primary" disabled={!text.trim()}>
              {lines ? `Visualize ${lines} commits` : 'Visualize'}
            </Button>
          </div>
          {error && <p role="alert" className="m-0 whitespace-pre-line text-sm text-danger">{error}</p>}
        </form>

        <p className="m-0 text-xs text-muted">Opening a local folder and connecting GitHub are planned.</p>
      </div>

      {model && (
        <section aria-label="Loaded repository" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="m-0 font-mono text-sm font-medium">{model.name}</h2>
            <span className="text-xs tabular-nums text-muted">
              {model.stats.commits} commits · {model.branches.length} branches · {model.authorCount} authors
            </span>
            <Button variant="ghost" className="ml-auto" onClick={() => onOpenGraph()}>
              Open graph →
            </Button>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-line bg-panel">
            <CommitGraph model={model} compact={PREVIEW_ROWS} onSelect={(hash) => onOpenGraph(hash)} />
            {model.order.length > PREVIEW_ROWS && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-24 bg-gradient-to-t from-panel to-transparent" />
            )}
          </div>
          <p className="m-0 text-xs text-muted">Click any commit to open it in the graph.</p>

          <div className="mt-6">
            <h2 className="m-0 mb-2 text-sm font-semibold">Try a sample</h2>
            <p className="m-0 mb-3 text-xs text-muted">Fictional repositories, generated in your browser.</p>
            <ul className="m-0 list-none border-t border-line p-0">
              {samples.map((s) => {
                const loaded = s.name === model.name
                return (
                  <li key={s.id} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => onLoadSample(s.id)}
                      aria-current={loaded ? 'true' : undefined}
                      className="group flex w-full cursor-pointer items-center gap-4 px-1 py-2.5 text-left transition-colors duration-150 hover:bg-fg/[0.04]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm text-fg">{s.name}</span>
                        <span className="block truncate text-xs text-muted">{s.blurb}</span>
                      </span>
                      <span className="flex-none text-right text-xs text-muted max-sm:hidden">{s.size}</span>
                      <span className={`w-16 flex-none text-right text-xs ${loaded ? 'text-path' : 'text-soft group-hover:text-fg'}`}>
                        {loaded ? 'Loaded' : 'Open →'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}
    </main>
  )
}
