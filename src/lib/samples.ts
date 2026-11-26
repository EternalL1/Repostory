// Fictional demo repositories for the Load page. Every one renders to the same text as GIT_LOG_COMMAND,
// so they go through the real parser. Generated from a fixed seed: identical on every load and deploy.
import { SAMPLE_NAME, sampleLogText } from './sample'

/** Small seeded PRNG (mulberry32): same seed, same repo. */
interface Rng {
  next: () => number
  int: (lo: number, hi: number) => number
  pick: <T>(list: T[]) => T
  chance: (p: number) => boolean
}
interface Author {
  name: string
  tz: number // minutes east of UTC
}
interface Area {
  verbs: string[]
  nouns: string[]
  files: string[]
}

function rng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T,>(list: T[]): T => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  }
}

function hash(id: string): string {
  let h = 2166136261
  let out = ''
  for (let k = 0; k < 5; k++) {
    for (const ch of `${id}:${k}`) {
      h ^= ch.charCodeAt(0)
      h = Math.imul(h, 16777619) >>> 0
    }
    out += h.toString(16).padStart(8, '0')
  }
  return out
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO date in the author's own timezone (minutes east of UTC), the way git prints %aI. */
function isoIn(ts: number, tz: number): string {
  const d = new Date(ts + tz * 60_000)
  const sign = tz < 0 ? '-' : '+'
  const off = Math.abs(tz)
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00` +
    `${sign}${pad(Math.floor(off / 60))}:${pad(off % 60)}`
  )
}

const HOUR = 3_600_000

/** Collects commits and refs, then prints them newest first as git log text. */
class Repo {
  name: string
  rows: { id: string; parents: string[]; author: string; date: string; subject: string; files: string[] }[]
  refs: Map<string, string[]>
  ts: number
  n: number

  constructor(name: string, startTs: number) {
    this.name = name
    this.rows = []
    this.refs = new Map()
    this.ts = startTs
    this.n = 0
  }

  /** Advances the clock, then mostly keeps commits in the author's working hours and weekdays. */
  tick(r: Rng, author: Author, minH = 0.5, maxH = 9): string {
    this.ts += (minH + r.next() * (maxH - minH)) * HOUR
    const local = () => new Date(this.ts + author.tz * 60_000)
    const toMorning = (days: number) => {
      const d = local()
      this.ts += (days * 24 + (9 - d.getUTCHours()) + r.next() * 2.5) * HOUR - d.getUTCMinutes() * 60_000
    }
    const hour = local().getUTCHours()
    if (hour < 8 && r.chance(0.9)) toMorning(0)
    else if (hour >= 21 && r.chance(0.7)) toMorning(1)
    const day = local().getUTCDay()
    if ((day === 0 || day === 6) && r.chance(0.75)) toMorning(day === 6 ? 2 : 1)
    return isoIn(this.ts, author.tz)
  }

  commit(parents: string[], author: Author, date: string, subject: string, files: string[] = []): string {
    const id = `${this.name}-${++this.n}`
    this.rows.push({ id, parents, author: author.name, date, subject, files })
    return id
  }

  ref(id: string, label: string) {
    this.refs.set(id, [...(this.refs.get(id) || []), label])
  }

  text(): string {
    return this.rows
      .slice()
      .reverse()
      .map(
        (c) =>
          `@@${hash(c.id)}|${c.parents.map(hash).join(' ')}|${c.author}|${c.date}|${(this.refs.get(c.id) || []).join(', ')}|${c.subject}` +
          (c.files.length ? `\n${c.files.join('\n')}` : ''),
      )
      .join('\n\n')
  }
}

const sampleOf = <T,>(list: T[], r: Rng, lo: number, hi: number): T[] => {
  const pool = list.slice()
  const out: T[] = []
  for (let k = r.int(lo, Math.min(hi, pool.length)); k > 0; k--) out.push(pool.splice(Math.floor(r.next() * pool.length), 1)[0])
  return out
}

const EDGES = ['offline mode', 'slow networks', 'long names', 'missing data', 'double submits', 'small screens', 'timezones']

/** A commit message for the n-th commit on a branch: start, work, then tests / edge cases / review. */
function messageFor(r: Rng, a: Area, topic: string, n: number): string {
  if (n === 0) return `${r.pick(['Add', 'Start', 'Scaffold', 'Introduce'])} ${topic}`
  return r.pick([
    () => `${r.pick(a.verbs)} ${topic}`,
    () => `${r.pick(a.verbs)} ${topic}`,
    () => `${r.pick(a.verbs)} ${r.pick(a.nouns)}`,
    () => `Tests for ${topic}`,
    () => `Handle ${r.pick(EDGES)} in ${topic}`,
    () => 'Address review feedback',
    () => `Clean up ${topic}`,
  ])()
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * Feature-branch flow: branches start from `trunk`, collect commits, and merge back.
 * Shared by the storefront (GitHub pull requests into main) and legacy (git-flow into develop) samples.
 */
interface Abandoned {
  name: string
  author: number
  at: number
  until: number
  backMerge?: boolean
  trunkName?: string
  topic?: string
  area?: string
}
interface FlowBranch {
  name: string
  area?: string
  topic?: string
  author: Author
  base: string
  tip: string | null
  count: number
  target: number
  backMerge?: boolean
  trunkName?: string
}
interface FlowState {
  tip: string
  merges: number
}
interface FlowOptions {
  trunk: string
  authors: Author[]
  areas: Record<string, Area>
  steps: number
  maxActive: number
  mergeMessage: (b: FlowBranch, n: number) => string
  onMerge?: (s: FlowState, by: Author) => void
  abandon?: Abandoned[]
  prefixes?: { feat: string; fix: string }
}

function runFlow(repo: Repo, r: Rng, { trunk, authors, areas, steps, maxActive, mergeMessage, onMerge, abandon = [], prefixes = { feat: 'feat', fix: 'fix' } }: FlowOptions) {
  const state: FlowState = { tip: trunk, merges: 0 }
  const active: FlowBranch[] = []
  const used = new Set(abandon.map((a) => a.name))
  const unique = (name: string) => {
    let n = name
    for (let k = 2; used.has(n); k++) n = `${name}-${k}`
    used.add(n)
    return n
  }
  const left: FlowBranch[] = [] // branches that never merged: their tips keep a ref

  for (let step = 0; step < steps; step++) {
    for (const a of abandon) {
      if (a.at === step) active.push({ ...a, base: state.tip, tip: null, count: 0, target: Infinity, author: authors[a.author] })
      if (a.until === step) {
        const i = active.findIndex((b) => b.name === a.name)
        if (i >= 0) left.push(active.splice(i, 1)[0])
      }
    }

    const ready = active.filter((b) => b.count >= b.target)
    const roll = r.next()
    if (active.length < maxActive && roll < 0.16) {
      const area = r.pick(Object.keys(areas))
      const kind = r.chance(0.7) ? prefixes.feat : prefixes.fix
      // never two open branches about the same thing
      const busy = new Set(active.map((b) => b.topic))
      const free = areas[area].nouns.filter((t) => !busy.has(t))
      const topic = r.pick(free.length ? free : areas[area].nouns)
      active.push({ name: unique(`${kind}/${slug(topic)}`), area, topic, author: r.pick(authors), base: state.tip, tip: null, count: 0, target: r.int(1, 6) })
    } else if (ready.length && roll < 0.42) {
      const b = r.pick(ready)
      active.splice(active.indexOf(b), 1)
      const by = r.pick(authors)
      state.tip = repo.commit([state.tip, b.tip!], by, repo.tick(r, by, 0.3, 4), mergeMessage(b, ++state.merges))
      onMerge?.(state, by)
    } else if (active.length) {
      const b = r.pick(active)
      const a = areas[b.area || r.pick(Object.keys(areas))]
      const who = r.chance(0.85) ? b.author : r.pick(authors)
      const parents = [b.tip || b.base]
      let subject = messageFor(r, a, b.topic || r.pick(a.nouns), b.count)
      // long-lived branches pull the trunk back in now and then
      if (b.backMerge && b.tip && r.chance(0.25)) {
        parents.push(state.tip)
        subject = `Merge branch '${b.trunkName}' into ${b.name}`
      }
      b.tip = repo.commit(parents, who, repo.tick(r, who), subject, parents.length > 1 ? [] : sampleOf(a.files, r, 1, 3))
      b.count++
    }
  }
  return { state, unmerged: [...active, ...left].filter((b) => b.tip) }
}

// ── acme-storefront: a busy web shop, 8 people across timezones, PRs into main ───────────────────────

function storefront() {
  const r = rng(20261101)
  const authors = [
    { name: 'Maya Chen', tz: -420 },
    { name: 'Leo Martins', tz: 0 },
    { name: 'Priya Nair', tz: 330 },
    { name: 'Jonas Weber', tz: 60 },
    { name: 'Aiko Tanaka', tz: 540 },
    { name: 'Sam Rivera', tz: -300 },
    { name: 'Noah Kim', tz: -480 },
    { name: 'Fatima Zahra', tz: 60 },
  ]
  const areas: Record<string, Area> = {
    cart: { verbs: ['Add', 'Fix', 'Refactor', 'Polish'], nouns: ['cart drawer', 'quantity stepper', 'cart totals', 'saved-for-later list', 'promo code field'], files: ['src/cart/CartDrawer.tsx', 'src/cart/useCart.ts', 'src/cart/totals.ts', 'src/cart/PromoCode.tsx'] },
    checkout: { verbs: ['Add', 'Fix', 'Handle', 'Validate'], nouns: ['address form', 'Stripe payment step', 'order summary', 'shipping options', 'guest checkout'], files: ['src/checkout/Checkout.tsx', 'src/checkout/AddressForm.tsx', 'src/checkout/payment.ts', 'api/orders.ts'] },
    search: { verbs: ['Add', 'Speed up', 'Fix', 'Improve'], nouns: ['search filters', 'typeahead', 'search ranking', 'empty results state', 'facet counts'], files: ['src/search/SearchBar.tsx', 'src/search/filters.ts', 'api/search.ts', 'src/search/Results.tsx'] },
    catalog: { verbs: ['Add', 'Fix', 'Lazy-load', 'Refactor'], nouns: ['product gallery', 'variant picker', 'size guide', 'stock badge', 'product reviews'], files: ['src/catalog/ProductPage.tsx', 'src/catalog/Gallery.tsx', 'src/catalog/VariantPicker.tsx', 'api/products.ts'] },
    auth: { verbs: ['Add', 'Fix', 'Harden', 'Refactor'], nouns: ['magic-link sign in', 'session refresh', 'account page', 'password reset'], files: ['src/auth/session.ts', 'src/auth/SignIn.tsx', 'api/auth.ts', 'src/account/Account.tsx'] },
    ui: { verbs: ['Polish', 'Fix', 'Add', 'Tweak'], nouns: ['button styles', 'dark mode', 'toast messages', 'mobile nav', 'focus rings'], files: ['src/ui/Button.tsx', 'src/ui/theme.css', 'src/ui/Toast.tsx', 'src/ui/Nav.tsx'] },
    infra: { verbs: ['Bump', 'Fix', 'Add', 'Speed up'], nouns: ['CI cache', 'preview deploys', 'Sentry setup', 'image CDN', 'e2e tests'], files: ['.github/workflows/ci.yml', 'package.json', 'vite.config.ts', 'tests/e2e/checkout.spec.ts'] },
  }

  const repo = new Repo('store', Date.UTC(2026, 3, 1, 16))
  const maya = authors[0]
  let tip = repo.commit([], maya, repo.tick(r, maya), 'Initial commit', ['package.json', 'README.md', 'vite.config.ts', 'src/main.tsx'])
  tip = repo.commit([tip], maya, repo.tick(r, maya), 'Set up routing and layout', ['src/App.tsx', 'src/ui/Nav.tsx', 'src/ui/theme.css'])

  let pr = 40
  let minor = 0
  const { state, unmerged } = runFlow(repo, r, {
    trunk: tip,
    authors,
    areas,
    steps: 640,
    maxActive: 5,
    mergeMessage: (b) => `Merge pull request #${++pr} from ${b.author.name.split(' ')[0].toLowerCase()}/${b.name}`,
    onMerge: (s) => {
      if (s.merges % 14 === 0) repo.ref(s.tip, `tag: v1.${minor++}.0`)
    },
    abandon: [{ name: 'feat/gift-cards', author: 5, at: 60, until: 140 }],
  })

  repo.ref(state.tip, 'HEAD -> main')
  repo.ref(state.tip, 'origin/main')
  for (const b of unmerged) repo.ref(b.tip!, b.name)
  return repo.text()
}

// ── dotfiles: one person, a straight line ────────────────────────────────────────────────────────────

function dotfiles() {
  const r = rng(7)
  const sam = { name: 'Sam Okafor', tz: -300 }
  const repo = new Repo('dot', Date.UTC(2026, 3, 4, 2))
  const steps: [string, string[]][] = [
    ['Initial commit', ['README.md', '.zshrc']],
    ['Add git aliases', ['.gitconfig']],
    ['Starship prompt', ['.config/starship.toml', '.zshrc']],
    ['Neovim: lazy.nvim bootstrap', ['.config/nvim/init.lua']],
    ['Neovim: LSP and treesitter', ['.config/nvim/lua/lsp.lua', '.config/nvim/init.lua']],
    ['Install script', ['install.sh']],
    ['Fix install.sh on Linux', ['install.sh']],
    ['tmux config', ['.tmux.conf']],
    ['Ghostty theme', ['.config/ghostty/config']],
    ['Neovim: telescope keymaps', ['.config/nvim/lua/keymaps.lua']],
    ['Brewfile', ['Brewfile', 'install.sh']],
    ['Drop oh-my-zsh, plain zsh is faster', ['.zshrc']],
    ['README: setup steps', ['README.md']],
    ['mise for node and python versions', ['.config/mise/config.toml', '.zshrc']],
  ]
  let tip: string | null = null
  for (const [subject, files] of steps) {
    tip = repo.commit(tip ? [tip] : [], sam, repo.tick(r, sam, 30, 340), subject, files)
  }
  repo.ref(tip!, 'HEAD -> main')
  repo.ref(tip!, 'origin/main')
  return repo.text()
}

// ── legacy-billing: git-flow, release branches, abandoned work and an orphan gh-pages ────────────────

function legacyBilling() {
  const r = rng(1999)
  const authors = [
    { name: 'Greg Holloway', tz: 0 },
    { name: 'Ines Duarte', tz: 0 },
    { name: 'Tomasz Nowak', tz: 60 },
    { name: 'Rachel Oduya', tz: 180 },
    { name: 'Victor Lindqvist', tz: 60 },
  ]
  const areas: Record<string, Area> = {
    invoices: { verbs: ['Fix', 'Add', 'Rework', 'Patch'], nouns: ['invoice numbering', 'PDF footer', 'credit notes', 'late fees', 'invoice export'], files: ['app/models/invoice.rb', 'app/services/invoice_pdf.rb', 'app/controllers/invoices_controller.rb'] },
    tax: { verbs: ['Fix', 'Update', 'Add'], nouns: ['VAT rounding', 'EU reverse charge', 'tax rate table'], files: ['app/services/tax_calculator.rb', 'config/tax_rates.yml', 'spec/tax_calculator_spec.rb'] },
    payments: { verbs: ['Fix', 'Retry', 'Add', 'Log'], nouns: ['SEPA mandates', 'failed charge retries', 'refund flow', 'webhook signature check'], files: ['app/services/payments/sepa.rb', 'app/jobs/retry_charges_job.rb', 'app/controllers/webhooks_controller.rb'] },
    misc: { verbs: ['Fix', 'Bump', 'Remove', 'WIP'], nouns: ['flaky spec', 'Rails 6.1 deprecations', 'dead code', 'cron schedule'], files: ['Gemfile', 'Gemfile.lock', 'config/schedule.rb', 'spec/spec_helper.rb'] },
  }

  const repo = new Repo('legacy', Date.UTC(2025, 8, 1, 9))
  const greg = authors[0]
  let main = repo.commit([], greg, repo.tick(r, greg), 'Initial import from SVN (r4120)', ['Gemfile', 'app/models/invoice.rb', 'app/services/tax_calculator.rb', 'config/routes.rb'])
  let develop = repo.commit([main], greg, repo.tick(r, greg), 'Start develop branch', ['README.md'])

  let release = 3
  const { state, unmerged } = runFlow(repo, r, {
    trunk: develop,
    authors,
    areas,
    steps: 300,
    maxActive: 4,
    prefixes: { feat: 'feature', fix: 'bugfix' },
    mergeMessage: (b) => `Merge branch '${b.name}' into develop`,
    onMerge: (s, by) => {
      if (s.merges % 9 !== 0) return
      // release cycle: branch, fix, merge into main (tagged), merge back into develop
      const name = `release/2.${release}`
      let rel = repo.commit([s.tip], by, repo.tick(r, by), `Bump version to 2.${release}.0`, ['VERSION', 'CHANGELOG.md'])
      if (r.chance(0.7)) rel = repo.commit([rel], by, repo.tick(r, by), `Fix ${r.pick(areas.invoices.nouns)} for release`, ['app/services/invoice_pdf.rb'])
      main = repo.commit([main, rel], greg, repo.tick(r, greg, 0.5, 3), `Merge branch '${name}'`)
      repo.ref(main, `tag: v2.${release}.0`)
      s.tip = repo.commit([s.tip, rel], greg, repo.tick(r, greg, 0.2, 1), `Merge branch '${name}' into develop`)
      release++
    },
    abandon: [
      { name: 'feature/new-invoice-pdf', author: 2, at: 25, until: 70 },
      { name: 'spike/graphql-api', author: 4, at: 40, until: 55 },
      { name: 'feature/tax-rules-2025', author: 3, at: 90, until: 200, backMerge: true, trunkName: 'develop', topic: 'tax rules 2025', area: 'tax' },
    ],
  })

  // an orphan branch with its own root: no shared history with anything else
  const ines = authors[1]
  let pages = repo.commit([], ines, repo.tick(r, ines), 'Docs site', ['index.html', 'docs/api.md'])
  pages = repo.commit([pages], ines, repo.tick(r, ines), 'Document webhook payloads', ['docs/webhooks.md'])

  repo.ref(main, 'HEAD -> main')
  repo.ref(main, 'origin/main')
  repo.ref(state.tip, 'develop')
  repo.ref(state.tip, 'origin/develop')
  repo.ref(pages, 'gh-pages')
  for (const b of unmerged) repo.ref(b.tip!, b.name)
  return repo.text()
}

export const SAMPLES = [
  { id: 'android', name: SAMPLE_NAME, blurb: 'Small Android app: 4 people, feature branches through staging', text: sampleLogText },
  { id: 'storefront', name: 'acme-storefront', blurb: 'Busy web shop: 8 people in 7 timezones, pull requests, releases', text: storefront },
  { id: 'legacy', name: 'legacy-billing', blurb: 'Git-flow with release branches, abandoned work, an orphan gh-pages', text: legacyBilling },
  { id: 'dotfiles', name: 'dotfiles', blurb: 'One person, one straight line', text: dotfiles },
]

export const isSampleName = (name: string) => SAMPLES.some((s) => s.name === name)
