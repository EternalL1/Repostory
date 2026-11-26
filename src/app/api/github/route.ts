import { fetchRepoLog, GitHubError, parseRepoInput } from '../../../lib/github'

// a big repository is ~20 GitHub requests in one wave; give a slow GitHub day room before the platform stops it
export const maxDuration = 60

const STATUS: Record<GitHubError['code'], number> = { 'bad-input': 400, 'not-found': 404, 'rate-limited': 429, 'not-configured': 500, upstream: 502 }

/**
 * A public GitHub repository's history in the app's git log format: GET /api/github?repo=owner/name.
 * Answers are cached by Vercel's CDN for 10 minutes per repository, so loading a popular repo again costs GitHub nothing.
 */
export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get('repo') ?? ''
  const repo = parseRepoInput(input)
  if (!repo) return Response.json({ error: 'Paste a GitHub repository link, like github.com/owner/name.' }, { status: 400 })

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.error('github: GITHUB_TOKEN is not set')
    return Response.json({ error: 'Loading from GitHub isn’t set up yet. Paste the git log instead.' }, { status: 500 })
  }

  try {
    const log = await fetchRepoLog(repo.owner, repo.name, token)
    return Response.json(log, { headers: { 'cache-control': 'public, s-maxage=600, stale-while-revalidate=3600' } })
  } catch (e) {
    if (e instanceof GitHubError) {
      if (e.code === 'not-configured' || e.code === 'upstream') console.error('github:', e.code, e.message)
      const message = e.code === 'not-configured' ? 'Loading from GitHub isn’t working right now. Paste the git log instead.' : e.message
      return Response.json({ error: message }, { status: STATUS[e.code], headers: { 'cache-control': 'no-store' } })
    }
    console.error('github: failed', e)
    return Response.json({ error: 'Loading from GitHub failed. Try again in a moment.' }, { status: 502 })
  }
}
