# RepoGraph

A frontend that shows a Git repository's history as a graph (a DAG), with a merge-base finder and team insights.
Built with **React + Vite + Tailwind CSS v4**. No backend: everything runs in the browser.

## Screens

| Tab | What it does |
| --- | --- |
| **Load** | Paste `git log` output, drop or open it as a .txt file. Includes a built-in sample repo. |
| **Graph** | Commit DAG with branch lanes. Search, filter by branch, highlight the longest path, graph stats, commit inspector. |
| **Compare** | Pick branches A and B: merge-base (lowest common ancestor), commits ahead on each side, diverged or fast-forward. |
| **Team** | Commits per author, weekday × hour heatmap, hotspot files and single owners, merge flow between branches. |

Opening a local folder and connecting GitHub are planned.

## Run it

```bash
npm install
npm run dev
```

## Load your own repo

Run this inside any Git repository, then paste the output into the **Load repo** tab:

```bash
git log --all --pretty=format:"@@%H|%P|%an|%aI|%D|%s" --name-only
```

For big repos, add `-n 500` to load only the latest 500 commits.

## Project structure

```
src/
  App.jsx                    renders <RepoGraph />
  index.css                  Tailwind + RepoGraph theme
  repograph/
    RepoGraph.jsx            app shell: state, tabs, loading
    theme.css                Tailwind v4 @theme tokens (colors, fonts)
    lib/
      git.js                 parse git log, topological sort, lane layout, longest path, merge-base
      team.js                author / heatmap / hotspot / merge-flow stats
      sample.js              fictional sample repo
      theme.js               lane + status colors for SVG
    components/
      CommitGraph.jsx        SVG graph + clickable commit rows
      Header.jsx, ui.jsx     shared UI pieces
    pages/
      LoadPage.jsx  GraphPage.jsx  ComparePage.jsx  TeamPage.jsx
```

## Adding it to an existing React + Tailwind app

1. Copy the `src/repograph/` folder into your project.
2. In your main CSS file, import the theme right after Tailwind:
   ```css
   @import "tailwindcss";
   @import "./repograph/theme.css";
   ```
3. Add the Google Fonts `<link>` from `index.html` (Inter, JetBrains Mono).
4. Render `<RepoGraph />` on any page or route.

The theme uses its own color names (`ink`, `panel`, `line`, `accent`, `branch-a`…) and adds two utilities, `press` (scale on press) and `material` (translucent header). If your app already defines colors with those names, rename them in `theme.css` and in the components.

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
        fg: '#eceef1', muted: '#7d8591', soft: '#a2a9b4', subtle: '#c5cad1',
        accent: '#5e9eff', danger: '#ff7b72', merge: '#ff7eb6',
        'branch-a': '#4ea1ff', 'branch-b': '#ff9f43', 'merge-base': '#f5d547', path: '#3ddc97',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
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
