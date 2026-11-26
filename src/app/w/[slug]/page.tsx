import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { getShare } from '../../../db/shares'
import { fmt } from '../../../lib/story'
import SharedStory from './SharedStory'

type Props = { params: Promise<{ slug: string }> }

// A share never changes, so each page is built on its first visit and kept for 5 minutes. Deleting a link purges
// it at once (api/shares/[slug]); an expired link stops opening within those 5 minutes.
export const revalidate = 300
export const generateStaticParams = () => []

// metadata and the page both need the share: read it once per request
const load = cache((slug: string) => getShare(slug))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const share = await load((await params).slug)
  if (!share) return { title: 'Story not found · Repostory' }
  const { stats } = share
  const title = `The story of ${stats.name}`
  const description = `${fmt(stats.commits)} commits by ${stats.authors === 1 ? '1 person' : `${stats.authors} people`}, ${stats.range}. Made with Repostory.`
  return { title: `${title} · Repostory`, description, openGraph: { title, description, type: 'website' }, twitter: { card: 'summary_large_image', title, description } }
}

export default async function SharedStoryPage({ params }: Props) {
  const { slug } = await params
  const share = await load(slug)
  if (!share) notFound()
  return <SharedStory slug={slug} snapshot={share.stats} expiresAt={share.expiresAt.toISOString()} />
}
