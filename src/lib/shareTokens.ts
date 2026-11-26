// Delete tokens for the share links this browser made. The server keeps only a hash, so this is the one copy:
// clearing site data means the link can no longer be deleted from here.
const KEY = 'repostory.shareTokens'

function read(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function write(tokens: Record<string, string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tokens))
  } catch {
    /* storage unavailable: the link still works, it just can't be deleted later from this browser */
  }
}

export const rememberToken = (slug: string, token: string) => write({ ...read(), [slug]: token })
export const tokenFor = (slug: string): string | null => read()[slug] ?? null

/** Deletes a share link made in this browser; throws with a message to show when it can't. */
export async function deleteLink(slug: string) {
  const token = tokenFor(slug)
  if (!token) throw new Error('This browser does not have the key to delete that link.')
  const res = await fetch(`/api/shares/${slug}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } })
  if (!res.ok && res.status !== 404) throw new Error((await res.json().catch(() => ({}))).error || 'Could not delete the link.')
  const { [slug]: _gone, ...rest } = read()
  write(rest)
}
