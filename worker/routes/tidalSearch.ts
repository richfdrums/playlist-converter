import type { Track } from '../../shared/types'
import { HttpError, type Env } from '../env'
import { COUNTRY, tidalGet, toTracks, type Document, type Resource } from './tidal'

export type TidalCandidate = Track & { id: string }

// Catalog search for the Tidal *destination*. Tidal only allows catalog reads with the app's
// client-credentials token (user tokens would need an internal-only scope), so it lives here.
export async function searchTidalTracks(env: Env, url: URL): Promise<TidalCandidate[]> {
  const isrc = url.searchParams.get('isrc')
  const q = url.searchParams.get('q')

  if (isrc) {
    if (!/^[A-Z0-9]{12}$/i.test(isrc)) throw new HttpError(400, 'Invalid ISRC')
    const query = new URLSearchParams({
      countryCode: COUNTRY,
      include: 'artists',
      'filter[isrc]': isrc,
    })
    return toCandidates(await tidalGet(env, `/tracks?${query}`))
  }

  if (q && q.length <= 200) {
    const search = await tidalGet(
      env,
      `/searchResults/${encodeURIComponent(q)}/relationships/tracks?countryCode=${COUNTRY}`,
    )
    const ids = (search.data as Resource[]).slice(0, 8).map((r) => r.id)
    if (!ids.length) return []
    const query = new URLSearchParams({ countryCode: COUNTRY, include: 'artists' })
    for (const id of ids) query.append('filter[id]', id)
    return toCandidates(await tidalGet(env, `/tracks?${query}`))
  }

  throw new HttpError(400, 'Pass ?isrc= or ?q=')
}

function toCandidates(doc: Document): TidalCandidate[] {
  return toTracks(doc).map(([id, track]) => ({ id, ...track }))
}
