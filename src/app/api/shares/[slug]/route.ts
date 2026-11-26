import { revalidatePath } from 'next/cache'
import { deleteShare } from '../../../../db/shares'

/** Deletes a share. Send the token from creation as `Authorization: Bearer <token>`; 204 when gone. */
export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const token = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1] ?? ''
  const { slug } = await params
  try {
    // a wrong token answers the same as an unknown link, so the response says nothing about which it was
    if ((await deleteShare(slug, token)) === 'deleted') {
      purge(slug)
      return new Response(null, { status: 204 })
    }
    return Response.json({ error: 'No share with that link and token.' }, { status: 404 })
  } catch (e) {
    console.error('delete failed', e)
    return Response.json({ error: 'Could not delete the share link. Try again in a moment.' }, { status: 500 })
  }
}

/** Drops the cached page and card for a deleted link, so it stops opening now rather than when the cache runs out. */
function purge(slug: string) {
  try {
    revalidatePath(`/w/${slug}`)
    revalidatePath(`/w/${slug}/opengraph-image`)
  } catch {
    /* outside a Next.js request (tests): nothing is cached */
  }
}
