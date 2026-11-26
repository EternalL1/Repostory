# Repostory

The story behind a Git repository: its history as a graph (a DAG), a merge-base finder, team insights, and a
tap-through Story recap that ends on a poster you can share.
Built with **Next.js (App Router) + TypeScript + Tailwind CSS v4**, on Vercel. Everything about your repo runs in the browser;
the only thing a server ever stores is a Story you choose to share (its computed numbers, never your git log).

**Live:** https://repostory-mu.vercel.app

## Screens

| Tab | What it does |
| --- | --- |
| **Load** | Paste `git log` output, drop or open it as a .txt file, next to a live preview of the loaded graph. Four fictional sample repos to try (see below). |
| **Graph** | Commit DAG with branch lanes in an app shell: branch rail, graph, docked commit inspector. Search, filter by branch, highlight the longest path. `j` / `k` (or arrows) move the selection, `Esc` clears it. |
| **Compare** | "Compare A with B" answers in one line: diverged at the merge-base (lowest common ancestor) or fast-forward, plus the commits only on each side. |
| **Team** | Commits per author, weekday × hour heatmap, hotspot files and single owners, merge flow between branches. |
| **Story** | A tap-through recap of the repo in full-screen slides, for flexing your work: commits, the contribution calendar, the greenest month, biggest day, longest streak (lit on the calendar), when the team works, top contributors, most-changed files. Ends on a poster you can save as a 1080×1920 PNG, or a share link (`/w/<slug>`) with its own preview card. |

Opening a local folder and connecting GitHub are planned.

## Run it

```bash
git clone https://github.com/EternalL1/Repostory.git
cd Repostory
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest: graph algorithms, the snapshot schema, the share store (in memory and on PGlite) and API
```

Everything runs from the repository root; there is no inner app folder. Without `DATABASE_URL`, share links work
locally but live in memory until the dev server restarts.

## Sample repos

All fictional, generated in the browser from a fixed seed (`src/lib/samples.js`), so they look the same on every load and deploy. They go through the same parser as real `git log` output.

| Sample | What it shows |
| --- | --- |
| `acme-storefront` (default) | ~470 commits, 8 people in 7 timezones, pull requests into `main`, release tags, a stale branch |
| `legacy-billing` | git-flow: `develop`, release branches merged both ways, abandoned branches, an orphan `gh-pages` with no shared history |
| `sample-android-app` | 22 hand-written commits through a `staging` branch |
| `dotfiles` | one person, one straight line |

## Deploy on Vercel

The Vercel project imports `EternalL1/Repostory` with **Root Directory** empty (the app is at the repository root).
Every push to `main` redeploys.

Share links need a Postgres database and a cron secret:

1. In the Vercel project: **Storage → Create Database → Neon**, connected to this project. That sets `DATABASE_URL`.
2. Create the table once: `npx vercel env pull .env.local`, then `npm run db:migrate`
   (SQL in `drizzle/`, generated from `src/db/schema.ts` by `npm run db:generate`).
3. Add an environment variable `CRON_SECRET` (any long random string, e.g. `openssl rand -hex 32`). Vercel sends it
   to the daily cleanup job in `vercel.json`; without it the job refuses to run and expired rows stay in the table
   (they still never open).
4. Recommended: a **Firewall → Rate limit** rule on `/api/shares` (for example 10 requests a minute per IP).

How a share works:

- It stores a checked snapshot of the Story stats (`src/db/snapshot.ts`), never the git log, and a hash of a delete
  token. The token is shown once, kept in the creator's browser, and sent as `Authorization: Bearer <token>` to
  `DELETE /api/shares/<slug>`.
- It expires after `SHARE_TTL_DAYS` (365). Expired links read as not found at once; `/api/cron/cleanup-shares` deletes
  them daily at 04:00 UTC.
- At most `MAX_SHARES_PER_HOUR` (300) links are made per rolling hour across everyone; past that the API answers 429.
- `/w/<slug>` and its card are cached for 5 minutes; deleting a link purges them right away.
- When the Story's shape changes, bump `SNAPSHOT_VERSION` and teach `getShare` to read the older rows.

## Load your own repo

Run this inside any Git repository, then paste the output into the **Load** tab:

```bash
git log --all --pretty=format:"@@%H|%P|%an|%aI|%D|%s" --name-only
```

For big repos, add `-n 500` to load only the latest 500 commits.

## Project structure

```
next.config.ts, drizzle.config.ts, vercel.json, package.json
drizzle/                   SQL migrations for the shares table
src/
  app/
    layout.tsx             fonts, theme script, metadata
    page.tsx, ClientApp.tsx  the app, rendered in the browser only
    api/shares/            POST a Story's stats for a slug + delete token; DELETE /api/shares/[slug] with the token
    api/cron/cleanup-shares/  daily: deletes expired share links
    w/[slug]/              a shared Story: page + opengraph-image (the link preview card)
    globals.css            Tailwind + the theme
  theme.css                Tailwind v4 @theme tokens (colors, fonts), light and dark
  db/
    schema.ts, index.ts    Drizzle schema and the Neon client
    snapshot.ts            the zod schema every shared Story must pass, and its version
    shares.ts              save, read, delete and expire shared Stories (delete tokens are stored hashed)
  lib/
    git.ts                 parse git log, topological sort, lane layout, longest path, merge-base (+ git.test.ts)
    team.ts                author / heatmap / hotspot / merge-flow / day stats
    story.ts               Story numbers, including the contribution calendar
    storyImage.ts          the Story poster, drawn to a 1080×1920 PNG
    samples.ts, sample.ts  fictional sample repos (seeded generators + the hand-written Android one)
    theme.ts               lane + status colors for SVG, as CSS variables
  components/
    App.jsx                app shell: the loaded repository, tabs, every page
    CommitGraph.jsx        SVG graph + clickable commit rows
    Header.jsx, ui.jsx     header, tabs, theme toggle, shared UI pieces
    pixel.jsx              pixel-art logo and icons
    story/                 Story slides, pixel backdrops and avatars, motion
  tabs/
    LoadPage.jsx  GraphPage.jsx  ComparePage.jsx  TeamPage.jsx  StoryPage.jsx
  assets/og-fonts/         static WOFF fonts for the share card
```

## Adding it to an existing React + Tailwind app

1. Copy `src/theme.css` and the `src/components/`, `src/lib/` and `src/tabs/` folders into a folder of your project (say `src/repostory/`). The lib is TypeScript.
2. In your main CSS file, import the theme right after Tailwind:
   ```css
   @import "tailwindcss";
   @import "./repostory/theme.css";
   ```
3. Install and import the fonts once (see `src/app/layout.tsx`): `npm i @fontsource-variable/mona-sans @fontsource/monaspace-neon`. They are GitHub's open-source Mona Sans and Monaspace Neon (OFL), served from your own bundle. Without them the theme falls back to the system font stack.
4. Render its `App` (e.g. `import Repostory from './repostory/components/App.jsx'`, then `<Repostory />`) on any page or route, in the browser only (it reads `localStorage` on first render).

The theme uses its own color names (`ink`, `panel`, `line`, `accent`, `branch-a`…) and adds two utilities, `press` (scale on press) and `material` (translucent header). If your app already defines colors with those names, rename them in `theme.css` and in the components.

### Light and dark

The theme follows the OS setting. The button at the right of the header cycles **System → Light → Dark**, and a pick is saved in `localStorage` (`repograph.theme`, a key that keeps the app's earlier name so saved choices survive). `theme.css` defines the dark values in `@theme static` and overrides them for light under `:root[data-theme="light"]` and `prefers-color-scheme: light`. Graph and author colors in `lib/theme.ts` point at the same CSS variables, so they switch too. Copy the small inline script from `src/app/layout.tsx` if you want a saved choice applied before first paint.

### On Tailwind v3?

Skip `theme.css` and add the same tokens to `tailwind.config.js`:

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0c0f', panel: '#111418', 'panel-2': '#171b21', 'panel-3': '#1d222a',
        line: '#21262d', 'line-strong': '#30363f', 'line-hover': '#3d4550',
        fg: '#e6edf3', muted: '#9198a1', soft: '#a2a9b4', subtle: '#c5cad1',
        accent: '#5e9eff', danger: '#ff7b72', merge: '#ff7eb6',
        'branch-a': '#4ea1ff', 'branch-b': '#ff9f43', 'merge-base': '#f5d547', path: '#3ddc97',
      },
      fontFamily: {
        sans: ['"Mona Sans Variable"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Noto Sans"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"Monaspace Neon"', 'ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
    },
  },
}
```

## Graph theory notes

Edges point from child to parent, the way Git stores them:

- **Out-degree** = number of parents. Two or more means a merge commit.
- **In-degree** = number of children. Two or more means a branch point.
- **Tips** are sources (in-degree 0); **roots** are sinks (out-degree 0).
- **Merge-base** = lowest common ancestor of two commits.
- **Longest path** is found in linear time with dynamic programming over a topological order.
