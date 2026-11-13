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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// TIDAL allows only a short burst of requests (about 5) before answering 429 with a Retry-After
// of a few seconds, so we wait as told and try again rather than failing the whole playlist.
const MAX_ATTEMPTS = 6

export async function tidalGet(env: Env, pathAndQuery: string): Promise<Document> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${pathAndQuery}`, {
      headers: {
        Authorization: `Bearer ${await getAppToken(env)}`,
        Accept: 'application/vnd.api+json',
      },
    })
    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      await sleep((Number(res.headers.get('Retry-After')) || 2) * 1000)
      continue
    }
    if (res.status === 404) throw new HttpError(404, 'Not found on Tidal (is the playlist public?)')
    if (res.status === 429)
      throw new HttpError(429, 'TIDAL is busy right now. Try again in a minute.')
    if (!res.ok) throw new HttpError(502, `Tidal API error (${res.status})`)
    return res.json()
  }
}

export async function getTidalPlaylist(env: Env, id: string): Promise<SourcePlaylist> {
  const playlist = await tidalGet(env, `/playlists/${id}?countryCode=${COUNTRY}`)
  const attrs = (playlist.data as Resource).attributes ?? {}

  // Walk the cursor-paginated items (20 per page). `include=items,items.artists` returns each
  // page's tracks *and* their artists, so one request covers 20 tracks completely.
  const tracks: Track[] = []
  let next: string | undefined =
    `/playlists/${id}/relationships/items?countryCode=${COUNTRY}&include=items,items.artists`
  while (next && tracks.length < MAX_ITEMS) {
    const page = await tidalGet(env, next)
    const included = page.included ?? []
    const tracksById = new Map(
      toTracks({ data: included.filter((r) => r.type === 'tracks'), included }),
    )
    // page.data holds the playlist order; videos (type "videos") are skipped.
    for (const item of page.data as Resource[]) {
      const track = item.type === 'tracks' && tracksById.get(item.id)
      if (track) tracks.push(track)
    }
    next = page.links?.next
  }

  return {
    service: 'tidal',
    id,
    name: String(attrs.name ?? 'Tidal playlist'),
    description: attrs.description ? String(attrs.description) : undefined,
    tracks,
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
