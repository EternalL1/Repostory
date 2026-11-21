import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../components/story/story.css'
import { Backdrop } from '../components/story/art.jsx'
import { slidesFor, StoryPaused, Summary } from '../components/story/slides.jsx'
import { Button } from '../components/ui.jsx'
import { storyStats } from '../lib/story.js'
import { savePoster } from '../lib/storyImage.js'

const DURATION = 6500 // ms per slide, unless the slide sets its own (a calendar or a list needs longer)
const HOLD_MS = 220 // a press longer than this pauses instead of moving on

const Icon = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
const PauseIcon = () => <Icon><path d="M8 5v14M16 5v14" /></Icon>
const PlayIcon = ({ size }) => <Icon size={size}><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></Icon>
const CloseIcon = () => <Icon><path d="M6 6l12 12M18 6L6 18" /></Icon>
const ChevronIcon = ({ dir }) => <Icon size={20}>{dir === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}</Icon>
const ShareIcon = () => <Icon size={16}><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></Icon>
const ReplayIcon = () => <Icon size={16}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Icon>

// light slide backgrounds get dark chrome (progress, buttons), dark ones get white
const isLight = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b > 140
}

/** One slide on its card: color, backdrop, content. Re-keyed per slide so the entrance plays every time. */
function SlideView({ slide, stats }) {
  const { theme, backdrop, render: Render } = slide
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: theme.bg, color: theme.fg }}>
      {backdrop && <Backdrop {...backdrop} />}
      <Render s={stats} theme={theme} />
    </div>
  )
}

/** Full-screen story player: auto-advances, tap right/left to move, hold to pause, arrows and Esc on a keyboard. */
function StoryPlayer({ stats, onClose }) {
  const slides = useMemo(() => slidesFor(stats), [stats])
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)
  const [saving, setSaving] = useState(false)
  const bars = useRef([])
  const progress = useRef(0)
  const press = useRef(null)
  const dialog = useRef(null)
  const last = index === slides.length - 1

  const go = useCallback(
    (to) => {
      if (to < 0) to = 0
      if (to >= slides.length) return
      progress.current = 0
      setIndex(to)
    },
    [slides.length],
  )

  // progress bars are painted straight to the DOM each frame, so the slide itself does not re-render
  useEffect(() => {
    let raf = 0
    let prev = performance.now()
    const tick = (now) => {
      const dt = now - prev
      prev = now
      if (!paused && !held && !last) progress.current = Math.min(1, progress.current + dt / (slides[index].duration || DURATION))
      if (last) progress.current = 1
      bars.current.forEach((el, i) => {
        if (el) el.style.transform = `scaleX(${i < index ? 1 : i > index ? 0 : progress.current})`
      })
      if (progress.current >= 1 && !last) go(index + 1)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [index, paused, held, last, go, slides])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
      else if (e.key === ' ' && e.target === dialog.current) {
        e.preventDefault()
        setPaused((p) => !p)
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, go, onClose])

  // lock page scroll and take focus while open; give focus back on close
  useEffect(() => {
    const before = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      before?.focus?.()
    }
  }, [])

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    press.current = { t: performance.now(), x: e.clientX, timer: setTimeout(() => setHeld(true), HOLD_MS) }
  }
  const onPointerUp = (e) => {
    const p = press.current
    press.current = null
    if (!p) return
    clearTimeout(p.timer)
    setHeld(false)
    if (performance.now() - p.t >= HOLD_MS) return // that was a hold
    const rect = e.currentTarget.getBoundingClientRect()
    if (p.x - rect.left < rect.width * 0.3) go(index - 1)
    else go(index + 1)
  }
  const onPointerCancel = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
    setHeld(false)
  }
  const stop = (e) => e.stopPropagation()

  const save = async () => {
    setSaving(true)
    try {
      await savePoster(stats)
    } finally {
      setSaving(false)
    }
  }

  const slide = slides[index]
  const light = isLight(slide.theme.bg)
  const chrome = light ? 'text-black/80' : 'text-white/90'
  const roundBtn = `press grid size-9 cursor-pointer place-items-center rounded-full ${light ? 'hover:bg-black/10' : 'hover:bg-white/15'}`

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 backdrop-blur-md" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous" className="press absolute left-[max(16px,calc(50%-min(46dvh,440px)*9/16-72px))] grid size-11 cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:invisible max-sm:hidden">
        <ChevronIcon dir="left" />
      </button>
      <button type="button" onClick={() => go(index + 1)} disabled={last} aria-label="Next" className="press absolute right-[max(16px,calc(50%-min(46dvh,440px)*9/16-72px))] grid size-11 cursor-pointer place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:invisible max-sm:hidden">
        <ChevronIcon dir="right" />
      </button>

      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`${stats.name} story`}
        tabIndex={-1}
        className={`relative h-dvh w-screen touch-manipulation select-none overflow-hidden font-sans outline-none sm:aspect-[9/16] sm:h-[min(92dvh,880px)] sm:w-auto sm:rounded-[22px] sm:shadow-[0_30px_80px_rgba(0,0,0,0.6)] ${paused || held ? 'story-paused' : ''}`}
        style={{ containerType: 'size' }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <StoryPaused.Provider value={paused || held}>
          <SlideView key={slide.id} slide={slide} stats={stats} />
        </StoryPaused.Provider>

        {/* chrome: progress, logo, pause, close. Fades while held so the slide can be read. */}
        <div className={`absolute inset-x-0 top-0 z-10 px-3 pt-3 transition-opacity duration-200 ${held ? 'opacity-0' : ''}`} style={{ background: `linear-gradient(${light ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.35)'}, transparent)` }}>
          <div className="flex gap-1">
            {slides.map((s, i) => (
              <div key={s.id} className={`h-[3px] flex-1 overflow-hidden rounded-full ${light ? 'bg-black/20' : 'bg-white/30'}`}>
                <div ref={(el) => {
                  bars.current[i] = el
                }} className={`h-full origin-left rounded-full ${light ? 'bg-black/80' : 'bg-white'}`} style={{ transform: 'scaleX(0)' }} />
              </div>
            ))}
          </div>
          <div className={`mt-2 flex items-center gap-1 ${chrome}`} onPointerDown={stop} onPointerUp={stop}>
            <span className="mr-auto pl-1 font-mono text-xs opacity-80">
              {index + 1} / {slides.length} · {slide.label}
            </span>
            {!last && (
              <button type="button" className={roundBtn} onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>
                {paused ? <PlayIcon size={18} /> : <PauseIcon />}
              </button>
            )}
            <button type="button" className={roundBtn} onClick={onClose} aria-label="Close story">
              <CloseIcon />
            </button>
          </div>
        </div>

        {last && (
          <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-5" onPointerDown={stop} onPointerUp={stop}>
            <button type="button" onClick={save} disabled={saving} className="press inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60">
              <ShareIcon />
              {saving ? 'Saving…' : 'Save image'}
            </button>
            <button type="button" onClick={() => go(0)} className="press inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25">
              <ReplayIcon />
              Replay
            </button>
          </div>
        )}
        <span className="sr-only" aria-live="polite">{paused || held ? 'Paused' : ''}</span>
      </div>
    </div>
  )
}

export default function StoryPage({ model }) {
  const stats = useMemo(() => storyStats(model), [model])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const chapters = useMemo(() => slidesFor(stats), [stats])

  const save = async () => {
    setSaving(true)
    try {
      await savePoster(stats)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:py-16">
      <div className="min-w-0">
        <p className="m-0 font-mono text-xs text-muted">{stats.range}</p>
        <h1 className="m-0 mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          The story of <span className="font-mono text-[0.85em]">{stats.name}</span>
        </h1>
        <p className="m-0 mt-3 max-w-md text-base text-soft">
          A tap-through recap of the history you loaded: the biggest day, the longest streak, who carried it and the files
          that would not sit still. It ends on a poster you can save and share.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" className="min-h-10 px-4" onClick={() => setOpen(true)}>
            <PlayIcon size={14} />
            Play story
          </Button>
          <Button className="min-h-10 px-4" onClick={save} disabled={saving}>
            <ShareIcon />
            {saving ? 'Saving…' : 'Save poster'}
          </Button>
        </div>
        <ol className="m-0 mt-8 flex list-none flex-wrap gap-1.5 p-0">
          {chapters.map((c, i) => (
            <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-soft">
              <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: c.theme.bg, boxShadow: 'inset 0 0 0 1px var(--color-line-strong)' }} />
              <span className="tabular-nums text-muted">{i + 1}</span>
              {c.label}
            </li>
          ))}
        </ol>
        <p className="m-0 mt-6 text-xs text-muted">Tap the right side to move on, the left to go back, hold to pause. Arrow keys and Esc work too.</p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Play story"
        className="press group relative mx-auto block w-[300px] max-w-full cursor-pointer overflow-hidden rounded-[18px] text-left text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] ring-1 ring-line"
        style={{ aspectRatio: '9 / 16', background: '#15171c', containerType: 'size' }}
      >
        <Summary s={stats} animate={false} />
        <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors duration-200 group-hover:bg-black/35">
          <span className="grid size-14 scale-90 place-items-center rounded-full bg-white text-black opacity-0 transition-[opacity,transform] duration-200 ease-out-strong group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
            <PlayIcon size={22} />
          </span>
        </span>
      </button>

      {open && <StoryPlayer stats={stats} onClose={() => setOpen(false)} />}
    </main>
  )
}
