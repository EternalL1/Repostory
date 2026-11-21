import { useState } from 'react'
import { GIT_LOG_COMMAND } from '../lib/git.js'
import { Logo } from '../components/Header.jsx'
import { Button, SectionTitle } from '../components/ui.jsx'

function Pill({ color, children }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line px-3 py-2 text-[13px] text-subtle">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {children}
    </div>
  )
}

function SoonBadge() {
  return <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-muted">Coming soon</span>
}

export default function LoadPage({ model, error, onLoad, onLoadSample, onOpenGraph }) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(GIT_LOG_COMMAND)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard not available; the command is still selectable */
    }
  }

  const readFile = async (file) => {
    if (!file) return
    setText(await file.text())
    if (!name) setName(file.name.replace(/\.(txt|log)$/i, ''))
  }

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-10 px-8 pb-16 pt-14">
      <section className="flex flex-wrap items-end justify-between gap-10">
        <div className="min-w-0 flex-[1_1_520px]">
          <div className="mb-3 font-mono text-[13px] text-path">git log --graph, but readable</div>
          <h1 className="m-0 font-display text-5xl font-bold leading-[1.05] tracking-tight">
            See how your repository
            <br />
            really grew.
          </h1>
          <p className="mt-4 max-w-[560px] text-[17px] text-soft">
            RepoGraph turns your commit history into an interactive graph. Find where branches split, how far they've drifted,
            and who works on what.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Pill color="#7c9cff">Commit DAG</Pill>
          <Pill color="#f5d547">Merge-base finder</Pill>
          <Pill color="#ff9f43">Team insights</Pill>
        </div>
      </section>

      <section aria-label="Ways to load a repository" className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
        {/* Paste git log */}
        <form
          className="flex flex-col gap-3.5 rounded-2xl border border-accent bg-panel p-6"
          onSubmit={(e) => {
            e.preventDefault()
            onLoad(text, name.trim() || 'my-repo')
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c9cff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              <h2 className="m-0 text-[17px] font-semibold">Paste git log</h2>
            </div>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-ink">Works offline</span>
          </div>
          <p className="m-0 text-soft">Run this in your repo, then paste the output (or open it as a .txt file).</p>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-ink px-3 py-2.5">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-subtle">{GIT_LOG_COMMAND}</code>
            <button
              type="button"
              onClick={copy}
              aria-label="Copy command"
              className="grid size-8 flex-none cursor-pointer place-items-center rounded-md border border-line bg-panel-2 text-xs text-subtle"
            >
              {copied ? '✓' : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
              )}
            </button>
          </div>
          <label htmlFor="repoName" className="text-xs text-muted">Repository name</label>
          <input
            id="repoName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-repo"
            className="min-h-10 rounded-lg border border-line bg-ink px-3 font-mono text-[13px] text-fg"
          />
          <label htmlFor="logInput" className="text-xs text-muted">git log output</label>
          <textarea
            id="logInput"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              readFile(e.dataTransfer.files[0])
            }}
            spellCheck={false}
            placeholder="@@d8c7f83…|35a41d6… ae3c4f1…|Dan Lim|2026-10-13T19:10…"
            className="min-h-28 resize-y rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-xs text-fg"
          />
          {error && <p role="alert" className="m-0 whitespace-pre-line text-[13px] text-[#ff7b72]">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" className="min-h-11" disabled={!text.trim()}>
              Visualize
            </Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line bg-panel-2 px-4 font-semibold">
              Open .txt…
              <input type="file" accept=".txt,.log,text/plain" hidden onChange={(e) => readFile(e.target.files[0])} />
            </label>
          </div>
        </form>

        {/* Local folder */}
        <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3ddc97" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <h2 className="m-0 text-[17px] font-semibold">Open a local folder</h2>
            </div>
            <SoonBadge />
          </div>
          <p className="m-0 text-soft">
            Pick a folder that contains a <span className="font-mono text-[13px]">.git</span> directory. It will be read in your
            browser and never uploaded.
          </p>
          <div className="flex min-h-[150px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#3a4556] p-4 text-center text-muted">
            Drop a repo folder here
          </div>
          <Button disabled className="min-h-11 self-start">Choose folder…</Button>
        </div>

        {/* GitHub */}
        <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-panel p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff9f43" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="6" cy="6" r="2.5" />
                <circle cx="6" cy="18" r="2.5" />
                <circle cx="18" cy="9" r="2.5" />
                <path d="M6 8.5v7M18 11.5c0 3-4 3.5-9.5 5" />
              </svg>
              <h2 className="m-0 text-[17px] font-semibold">Connect a GitHub repo</h2>
            </div>
            <SoonBadge />
          </div>
          <p className="m-0 text-soft">
            Adds pull requests, reviews and which branch each PR targets, such as <span className="font-mono text-[13px]">staging</span>.
          </p>
          <label htmlFor="ghRepo" className="text-xs text-muted">Repository</label>
          <input
            id="ghRepo"
            disabled
            placeholder="owner/repository"
            className="min-h-11 rounded-lg border border-line bg-ink px-3 font-mono text-[13px] text-fg disabled:opacity-60"
          />
          <div className="flex-1" />
          <Button disabled className="min-h-11 self-start">Connect with GitHub</Button>
        </div>
      </section>

      <section aria-label="Loaded repository" className="flex flex-col gap-3">
        <SectionTitle>Loaded now</SectionTitle>
        <div className="flex flex-wrap gap-3">
          {model && (
            <button
              type="button"
              onClick={onOpenGraph}
              className="flex flex-[1_1_360px] cursor-pointer flex-wrap items-center gap-4 rounded-xl border border-line bg-panel px-5 py-4 text-left"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-panel-2"><Logo size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{model.name}</span>
                <span className="block text-[13px] text-muted">
                  {model.stats.commits} commits · {model.authorCount} authors · {model.branches.length} branches
                </span>
              </span>
              <span className="text-[13px] font-medium text-[#9db4ff]">Open graph →</span>
            </button>
          )}
          <Button onClick={onLoadSample} className="min-h-[72px] flex-[0_1_220px] rounded-xl">
            Load sample repo
          </Button>
        </div>
      </section>
    </main>
  )
}
