# Repostory

The story behind a Git repository: its history as a graph, a merge-base finder, team insights, and a tap-through
Story recap that ends on a poster or a link you can share.

**Live:** https://repostory-mu.vercel.app

Built with **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4** on Vercel, with Neon Postgres for shared Stories.

## What it does

| Tab | What it does |
| --- | --- |
| **Load** | Load a public GitHub repository by link, or paste `git log` output (or drop the file) for private repositories and file stats. Four fictional sample repositories to try. A live preview of the loaded graph sits beside it. |
| **Graph** | The commit graph with branch lanes: branch and tag rail, search, branch filter, longest path, and a commit inspector. `j` / `k` (or arrows) move the selection, `Esc` clears it. |
| **Compare** | "Compare A with B" in one line: where they diverged (the merge-base) or that one contains the other, plus the commits only on each side. |
| **Team** | Commits per person, a weekday × hour heatmap, days with commits and the longest streak, hotspot files and single owners, merge flow between branches. |
| **Story** | Full-screen slides to flex your work: commits, the contribution calendar, greenest month, longest streak, when the team works, biggest day, top contributors, most-changed files. Ends on a 1080×1920 poster to save, or a share link (`/w/<slug>`) with its own preview card. |

The Story's calendar keeps one square per day at any length:

| History | Calendar |
| --- | --- |
| Up to 5 weeks | A calendar page: weekdays across, one row per week, the date in each day |
| Up to a year | One strip across the card |
| 1–3 years | The same strip at the one-year size, sliding sideways to today |
| Over 3 years | One row per year, sliding from the first year down to today |

Viewers can scroll a moving calendar themselves; the Story pauses while they do. The Streak slide opens on the streak.

## Get a history in

**From GitHub:** paste `github.com/owner/name` (any page of the repository, or a clone URL) on the Load tab. It loads
the default branch's newest 2,000 commits plus every branch, with tags and `.mailmap` names. File stats need the pasted
log (see [Limits](#limits)).

**From your machine:** run this inside the repository and paste the output, or save it to a file and drop it:

```bash
# macOS: straight to the clipboard
git log --all --pretty=format:"@@%H|%P|%aN|%aI|%D|%s" --name-only | pbcopy
```

```powershell
# Windows PowerShell. To save a file, use Out-File -Encoding utf8: older PowerShell's ">" writes UTF-16, which won't load
git log --all --pretty=format:"@@%H|%P|%aN|%aI|%D|%s" --name-only | Set-Clipboard
```

`%aN` applies the repository's [`.mailmap`](https://git-scm.com/docs/gitmailmap), so one person committing under two
names (say, different git settings on two machines) counts once. Check with `git shortlog -sne --all`.

Histories of any size work: 50,000 commits load in about 0.3 s. For 100,000+ commits, `-n 50000` keeps the newest.

## Privacy

- A pasted log is read in the browser and never uploaded. Small logs (under ~4 MB) are kept in the browser's storage so
  a reload brings the repository back.
- A GitHub link is read by Repostory's server with its own token. Author emails are used there only to apply
  `.mailmap` and are never sent to the browser.
- A Story is stored only when someone presses **Share link**, and the share step lists exactly what goes up: the
  repository name, up to 5 contributor names, up to 5 file paths, the most common first word of commit messages, the
  busiest branch flow, and counts and dates. Never the log, commit messages or the rest of the files.
- Share links expire after a year. Whoever made one can delete it from its page in the same browser.

## Run it locally

```bash
git clone https://github.com/EternalL1/Repostory.git
cd Repostory
npm install
npm run dev      # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on port 5173 |
| `npm test` | Vitest, once (see [Tests](#tests)) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` / `npm start` | Production build, and serving it on port 5173 |
| `npm run db:generate` | Write a SQL migration from `src/db/schema.ts` into `drizzle/` |
| `npm run db:migrate` | Apply migrations to the database in `DATABASE_URL` (reads `.env.local`, uses the direct connection) |

Locally, share links live in memory until the dev server restarts, even when `.env.local` holds the real database.
Start with `USE_NEON_IN_DEV=1 npm run dev` to use it. GitHub links need `GITHUB_TOKEN` in the environment.

Working from a second machine: `git pull`, then `npm install` whenever `package.json` changed.

## Deploy on Vercel

The Vercel project imports `EternalL1/Repostory` with **Root Directory** empty. Every push to `main` deploys to
production; every other branch gets a preview at `repostory-git-<branch>-eternall1s-projects.vercel.app`.
`vercel.json` sets the Next.js output directory and the daily cleanup job.

| Variable | Environments | What it's for |
| --- | --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | all | Neon Postgres for share links. Set by **Storage → Create Database → Neon**. |
| `CRON_SECRET` | Production | Lets only Vercel's daily job delete expired links. A random string with no trailing newline: `openssl rand -hex 32 \| tr -d '\n'`. |
| `GITHUB_TOKEN` | Production, Preview | Reads public repositories for GitHub links. A fine-grained token with **Public repositories (read-only)** and no other permissions. It expires: renew it in GitHub and update it here. |

First-time setup:

1. Create the Neon database (above) with Development, Preview and Production ticked.
2. Create the table: `npx vercel env pull .env.local`, then `npm run db:migrate`.
3. Add `CRON_SECRET` and `GITHUB_TOKEN`.
4. **Firewall → Rate limit**: one rule for paths starting with `/api/`, 10 requests a minute per IP, any method. Hobby
   allows one rule; this one covers share links, deletes and GitHub loading.

## How it works

The app renders in the browser (`src/app/ClientApp.tsx` loads it without server rendering). Everything starts from one
text format, the output of the git log command above: `buildModel` in `src/lib/git.ts` parses it into a commit graph,
and every tab computes its numbers from that model. GitHub links reuse the same path: `/api/github` writes a repository
in that format, so nothing downstream knows the difference.

**State** is plain React: the loaded repository, tab and selection live in `App`, each tab derives what it needs, and
the Story player shares pause state through a small context. No store or data-fetching library; one is worth adding
when signed-in GitHub loading brings many requests at once.

**Big histories.** The Graph and Compare tabs draw only the rows on screen plus a 15-row margin, and the lane lines
crossing them, so 50,000 commits scroll like 50. Histories of 200 commits or fewer draw every row.

| Production build | 50,000 commits | 100,000 commits |
| --- | --- | --- |
| Load to graph (once) | 0.26 s | 0.5–0.7 s |
| Scroll, search | no freezes | no freezes |
| Open Compare | 0.05 s | 0.07 s |

**GitHub links** (`src/lib/github.ts`). GraphQL, with the default branch's first page in the same request as the refs.
GitHub's history cursor reads `<tip commit> <index>`, so once the first page confirms that shape, the other pages are
requested in one wave (any other shape falls back to page by page). Other branches are read back to where they join
loaded history; merged ones cost nothing. Answers are cached by Vercel's CDN for 10 minutes per repository. First loads
take about 1 s for small repositories, 3 s for mid-size ones, 7–15 s for the largest (GitHub's speed).

**Share links** (`src/db/`).

- `POST /api/shares` checks the Story against a strict zod schema (`snapshot.ts`): every name and path has a length limit,
  and words Repostory writes itself (persona, weekday, month) must be one of its own. Unknown fields are dropped.
- The calendar is stored as one count per day, so a 30-year history is a few KB. The shared page rebuilds the grid with
  the same `calendarFrom` the Story tab uses.
- The delete key is shown once, kept in the creator's browser, and stored only as a hash. It is sent as
  `Authorization: Bearer <key>` to `DELETE /api/shares/<slug>`.
- Links expire after 365 days and read as not found from then on. `/api/cron/cleanup-shares` deletes them daily at
  04:00 UTC.
- At most 300 links a rolling hour across everyone, on top of the firewall rule.
- `/w/<slug>` and its preview card (`next/og`, Mona Sans from `src/assets/og-fonts`) are cached for 5 minutes and purged
  when a link is deleted.
- When the Story's shape changes, bump `SNAPSHOT_VERSION` and teach `getShare` to read older rows.

## Tests

`npm test` runs about 80 Vitest tests:

| File | Covers |
| --- | --- |
| `src/lib/git.test.ts` | Parsing, topological order, lanes, longest path, merge-bases (including criss-cross merges), compare |
| `src/lib/story.test.ts` | The calendar rebuilt from daily counts matches the original exactly (samples, 15 and 30 years), layouts by length, share round trips, file labels |
| `src/db/shares.test.ts` | The snapshot schema, and the share store and API run twice: in memory and on PGlite (Postgres in process) with the real migration. Expiry, the hourly cap, the cron's secret check |
| `src/lib/github.test.ts` | Link parsing, a fake GitHub (branches, tags, paging, the limit, the one-wave cursor and its fallback), `.mailmap`, errors |

## Project structure

```
vercel.json, next.config.ts, drizzle.config.ts, package.json, .mailmap
drizzle/                     SQL migrations for the shares table
src/
  app/
    layout.tsx               fonts, theme script, metadata
    page.tsx, ClientApp.tsx  the app, rendered in the browser only
    api/github/              a public GitHub repository as git log text
    api/shares/              create a share link; DELETE /api/shares/[slug] with its key
    api/cron/cleanup-shares/ daily: deletes expired share links
    w/[slug]/                a shared Story: page + opengraph-image (the preview card)
    globals.css              Tailwind + the theme
  theme.css                  Tailwind v4 tokens (colors, fonts), light and dark
  db/
    schema.ts, index.ts      Drizzle schema and the Neon client
    snapshot.ts              the schema every shared Story must pass, and its version
    shares.ts                save, read, delete and expire shared Stories
  lib/
    git.ts                   parse git log, topological order, lanes, longest path, merge-base
    github.ts                read a GitHub repository into git log text; .mailmap
    team.ts                  people, heatmap, hotspots, merge flow, day stats
    story.ts                 Story numbers, the calendar (daily counts → grid), share snapshots
    storyImage.ts            the Story poster, drawn to a 1080×1920 PNG
    shareTokens.ts           delete keys for the share links this browser made
    samples.ts, sample.ts    fictional sample repositories (seeded generators + a hand-written one)
    theme.ts                 lane and status colors for SVG, as CSS variables
  components/
    App.jsx                  app shell: the loaded repository, tabs, every page
    CommitGraph.jsx          the graph: SVG lanes behind clickable rows, drawn for the rows on screen
    Header.jsx, ui.jsx       header, tabs, theme toggle, shared UI pieces
    pixel.jsx                pixel-art logo and icons
    story/                   slides, CalendarGrid (every calendar layout), pixel art, player context
  tabs/
    LoadPage.jsx  GraphPage.jsx  ComparePage.jsx  TeamPage.jsx  StoryPage.jsx
  assets/og-fonts/           static WOFF fonts for the preview card
```

## Sample repositories

All fictional, generated in the browser from a fixed seed (`src/lib/samples.ts`), so they look the same on every load.
They go through the same parser as real `git log` output.

| Sample | What it shows |
| --- | --- |
| `acme-storefront` (default) | ~470 commits, 8 people in 7 timezones, pull requests into `main`, release tags, a stale branch |
| `legacy-billing` | git-flow: `develop`, release branches merged both ways, abandoned branches, an orphan `gh-pages` |
| `sample-android-app` | 22 hand-written commits through a `staging` branch, about 4 weeks (the calendar page) |
| `dotfiles` | one person, one straight line |

## Theming

The theme follows the OS setting; the header button cycles **System → Light → Dark** and saves the pick in
`localStorage` (`repograph.theme`: the app's earlier name, kept so saved choices survive). `theme.css` defines dark
values in `@theme static` and overrides them for light. Graph and author colors in `lib/theme.ts` use the same CSS
variables, and an inline script in `src/app/layout.tsx` applies a saved choice before first paint. Fonts are GitHub's
Mona Sans and Monaspace Neon (OFL), bundled through fontsource.

## Limits

- GitHub links: public repositories only, no file stats (hotspots, Files slide), newest 2,000 commits on the default
  branch plus up to 1,000 from other branches. Pasting the git log has none of these limits.
- All GitHub loading shares one token's 5,000 requests an hour (about 150 uncached large repositories); the CDN cache
  covers repeats.
- Vercel's Hobby plan is for non-commercial use.

## Roadmap

- **Sign in with GitHub:** private repositories, and file stats for links, each person on their own GitHub limit.
- **Before a public launch:** a privacy note with a takedown contact, tests running on every push, usage analytics.
- Opening a local folder directly.

## Graph theory notes

Edges point from child to parent, the way Git stores them:

- **Out-degree** = number of parents. Two or more means a merge commit.
- **In-degree** = number of children. Two or more means a branch point.
- **Tips** are sources (in-degree 0); **roots** are sinks (out-degree 0).
- **Merge-base** = lowest common ancestor of two commits.
- **Longest path** is found in linear time with dynamic programming over a topological order.
