import { useRef, useState } from 'react'
import { GIT_LOG_COMMAND } from '../lib/git.js'
import { Logo } from '../components/Header.jsx'
import { Button, CopyButton, SectionTitle, fieldClass } from '../components/ui.jsx'

function Step({ n, title, children }) {
  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
      <span className="grid size-6 place-items-center rounded-full bg-panel-2 text-xs font-semibold tabular-nums text-subtle">{n}</span>
      <h2 className="m-0 self-center text-sm font-semibold">{title}</h2>
      <div className="col-start-2 flex min-w-0 flex-col gap-2.5">{children}</div>
    </div>
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

  return (
    <main className="mx-auto flex max-w-[880px] flex-col gap-10 px-4 pb-20 pt-12 sm:px-8 sm:pt-16">
      <section>
        <p className="m-0 mb-3 font-mono text-xs text-path">git log → graph</p>
        <h1 className="m-0 text-[clamp(2rem,5vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.025em]">
          See how your repository grew.
        </h1>
        <p className="mb-0 mt-4 max-w-[560px] text-[15px] leading-relaxed text-soft">
          RepoGraph turns commit history into a graph you can read: where branches split, how far they drifted, and who works on
          what. It runs in your browser; nothing is uploaded.
        </p>
      </section>

      <form
        className="flex flex-col gap-7 rounded-2xl border border-line bg-panel p-5 sm:p-7"
        onSubmit={(e) => {
          e.preventDefault()
          onLoad(text, name.trim() || 'my-repo')
        }}
      >
        <Step n="1" title="Run this inside your repository">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-ink py-1.5 pl-3 pr-1.5">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1 font-mono text-xs text-subtle">{GIT_LOG_COMMAND}</code>
            <CopyButton text={GIT_LOG_COMMAND} label="Copy command" />
          </div>
          <p className="m-0 text-xs text-muted">
            Big history? Add <code className="font-mono text-soft">-n 500</code> to load the latest 500 commits.
          </p>
        </Step>

        <Step n="2" title="Paste the output, or drop the file">
          <label htmlFor="logInput" className="sr-only">git log output</label>
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
              className={`${fieldClass} block min-h-36 w-full resize-y py-2.5 font-mono text-xs leading-relaxed ${
                dragging ? 'border-accent bg-accent/5' : ''
              }`}
            />
            {dragging && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg text-[13px] font-medium text-accent">
                Drop to load
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
              <label htmlFor="repoName" className="text-xs text-muted">Repository name</label>
              <input id="repoName" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-repo" className={`${fieldClass} font-mono`} />
            </div>
            <label className="press inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-line-strong bg-panel-2 px-3.5 text-[13px] font-medium hover:bg-panel-3">
              Open file…
              <input type="file" accept=".txt,.log,text/plain" hidden onChange={(e) => readFile(e.target.files[0])} />
            </label>
            <Button type="submit" variant="primary" disabled={!text.trim()}>
              {lines ? `Visualize ${lines} commits` : 'Visualize'}
            </Button>
          </div>
          {error && <p role="alert" className="m-0 whitespace-pre-line text-[13px] text-danger">{error}</p>}
        </Step>
      </form>

      <section aria-label="Loaded repository" className="flex flex-col gap-3">
        <SectionTitle>Loaded now</SectionTitle>
        <div className="flex flex-wrap gap-3">
          {model && (
            <button
              type="button"
              onClick={onOpenGraph}
              className="press group flex flex-[1_1_360px] cursor-pointer items-center gap-4 rounded-xl border border-line bg-panel px-4 py-3.5 text-left hover:border-line-strong hover:bg-panel-2"
            >
              <span className="grid size-9 flex-none place-items-center rounded-lg bg-panel-2 group-hover:bg-panel-3"><Logo size={20} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{model.name}</span>
                <span className="block text-xs tabular-nums text-muted">
                  {model.stats.commits} commits · {model.authorCount} authors · {model.branches.length} branches
                </span>
              </span>
              <span className="text-[13px] font-medium text-soft transition-transform duration-200 ease-out-strong group-hover:translate-x-0.5 group-hover:text-fg">
                Open graph →
              </span>
            </button>
          )}
          <Button onClick={onLoadSample} className="min-h-[66px] flex-[1_1_200px] rounded-xl sm:flex-[0_1_200px]">
            Load sample repo
          </Button>
        </div>
        <p className="m-0 text-xs text-muted">Opening a local folder and connecting GitHub are planned.</p>
      </section>
    </main>
  )
}
