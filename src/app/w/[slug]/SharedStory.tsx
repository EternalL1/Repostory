'use client'

import { useEffect, useState } from 'react'
import { PixelLogo as Logo } from '../../../components/pixel'
import { Button } from '../../../components/ui'
import { deleteLink, tokenFor } from '../../../lib/shareTokens'
import type { StoryStats } from '../../../lib/story'
import { StoryView } from '../../../tabs/StoryPage'

const formatDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })

/**
 * A shared Story, read-only: the same landing and player as the Story tab, without the loaded repo around it.
 * The browser that made the link also sees a way to delete it.
 */
export default function SharedStory({ slug, stats, expiresAt }: { slug: string; stats: StoryStats; expiresAt: string }) {
  const [mine, setMine] = useState(false)
  const [state, setState] = useState<{ status: 'shown' | 'deleting' | 'deleted'; message?: string }>({ status: 'shown' })

  // the delete token lives in localStorage, which only exists in the browser
  useEffect(() => setMine(Boolean(tokenFor(slug))), [slug])

  const remove = async () => {
    setState({ status: 'deleting' })
    try {
      await deleteLink(slug)
      setState({ status: 'deleted' })
    } catch (e) {
      setState({ status: 'shown', message: (e as Error).message })
    }
  }

  return (
    <div className="min-h-screen bg-ink font-sans text-sm leading-normal text-fg">
      <header className="border-b border-line px-4 sm:px-8">
        <div className="mx-auto flex min-h-14 max-w-5xl items-center gap-3">
          <a href="/" className="mr-auto flex items-center gap-2 font-semibold text-fg no-underline">
            <Logo size={20} />
            Repostory
          </a>
          {state.message && <span role="alert" className="text-danger">{state.message}</span>}
          {mine && state.status !== 'deleted' && (
            <Button variant="ghost" className="text-danger! hover:text-danger!" onClick={remove} disabled={state.status === 'deleting'}>
              {state.status === 'deleting' ? 'Deleting…' : 'Delete this link'}
            </Button>
          )}
        </div>
      </header>
      {state.status === 'deleted' ? (
        <main className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
          <h1 className="m-0 text-2xl font-semibold">Link deleted</h1>
          <p className="m-0 mt-2 text-soft">This Story is gone from the server, and the link no longer opens.</p>
          <a href="/" className="mt-6 inline-block text-accent">Make a new Story</a>
        </main>
      ) : (
        <>
          <StoryView stats={stats} shared />
          <p className="m-0 px-4 pb-10 text-center text-xs text-muted">This link expires on {formatDay(expiresAt)}.</p>
        </>
      )}
    </div>
  )
}
