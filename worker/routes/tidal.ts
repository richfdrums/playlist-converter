import { parseIsoDuration } from '../../shared/iso8601'
import type { SourcePlaylist, Track } from '../../shared/types'
import { HttpError, type Env } from '../env'

const API = 'https://openapi.tidal.com/v2'
const TOKEN_URL = 'https://auth.tidal.com/v1/oauth2/token'
export const COUNTRY = 'US'
const MAX_ITEMS = 1000

// Minimal JSON:API shapes — only the fields we read.
export interface Resource {
  id: string
  type: string
  attributes?: Record<string, unknown>
  relationships?: Record<string, { data?: { id: string; type: string }[] }>
}
export interface Document {
  data: Resource | Resource[]
  included?: Resource[]
  links?: { next?: string }
}

// App-level token, reused across requests while this Worker instance is warm.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getAppToken(env: Env): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.TIDAL_CLIENT_ID}:${env.TIDAL_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new HttpError(502, `Tidal auth failed (${res.status})`)
  const body = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
  return cachedToken.value
}

export async function tidalGet(env: Env, pathAndQuery: string): Promise<Document> {
  const res = await fetch(`${API}${pathAndQuery}`, {
    headers: {
      Authorization: `Bearer ${await getAppToken(env)}`,
      Accept: 'application/vnd.api+json',
    },
  })
  if (res.status === 404) throw new HttpError(404, 'Not found on Tidal (is the playlist public?)')
  if (res.status === 429) throw new HttpError(429, 'Tidal is rate limiting us — retrying…')
  if (!res.ok) throw new HttpError(502, `Tidal API error (${res.status})`)
  return res.json()
}

export async function getTidalPlaylist(env: Env, id: string): Promise<SourcePlaylist> {
  const playlist = await tidalGet(env, `/playlists/${id}?countryCode=${COUNTRY}`)
  const attrs = (playlist.data as Resource).attributes ?? {}

  // 1. Walk the cursor-paginated items relationship to get track IDs in playlist order.
  const trackIds: string[] = []
  let next: string | undefined = `/playlists/${id}/relationships/items?countryCode=${COUNTRY}`
  while (next && trackIds.length < MAX_ITEMS) {
    const page = await tidalGet(env, next)
    for (const item of page.data as Resource[]) {
      if (item.type === 'tracks') trackIds.push(item.id) // videos are skipped
    }
    next = page.links?.next
  }

  // 2. Fetch track details with artists, 20 at a time (the API's filter limit).
  const tracksById = new Map<string, Track>()
  for (let i = 0; i < trackIds.length; i += 20) {
    const query = new URLSearchParams({ countryCode: COUNTRY, include: 'artists' })
    for (const trackId of trackIds.slice(i, i + 20)) query.append('filter[id]', trackId)
    const doc = await tidalGet(env, `/tracks?${query}`)
    for (const [trackId, track] of toTracks(doc)) tracksById.set(trackId, track)
  }

  return {
    service: 'tidal',
    id,
    name: String(attrs.name ?? 'Tidal playlist'),
    description: attrs.description ? String(attrs.description) : undefined,
    tracks: trackIds.flatMap((trackId) => tracksById.get(trackId) ?? []),
    truncated: Boolean(next),
  }
}

/** Converts a JSON:API tracks document (with included artists) into [id, Track] pairs. */
export function toTracks(doc: Document): [string, Track][] {
  const artistNames = new Map(
    (doc.included ?? [])
      .filter((r) => r.type === 'artists')
      .map((r) => [r.id, String(r.attributes?.name ?? '')]),
  )
  const resources = Array.isArray(doc.data) ? doc.data : [doc.data]
  return resources.map((r) => {
    const a = r.attributes ?? {}
    // Tidal keeps "Live", "Remix" etc. in a separate version field; other services put it in the title.
    const title = a.version ? `${a.title} (${a.version})` : String(a.title)
    const artists = (r.relationships?.artists?.data ?? [])
      .map((ref) => artistNames.get(ref.id))
      .filter((name): name is string => Boolean(name))
    return [
      r.id,
      {
        title,
        artists,
        durationMs: parseIsoDuration(a.duration as string | undefined),
        isrc: a.isrc ? String(a.isrc) : undefined,
      },
    ]
  })
}
