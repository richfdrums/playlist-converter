import type { ServiceId } from './types'

export interface SourceRef {
  service: ServiceId
  id: string
}

// Playlist ID formats. The Worker re-validates IDs against these before calling upstream APIs.
export const ID_PATTERNS: Record<ServiceId, RegExp> = {
  tidal: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  spotify: /^[A-Za-z0-9]{22}$/,
  youtube: /^[A-Za-z0-9_-]{10,64}$/,
}

/**
 * Finds a playlist link in arbitrary text (Android's share sheet often sends "Check this out https://…")
 * and works out which service and playlist it points to. Returns null if it isn't a supported link.
 */
export function parseSourceUrl(input: string): SourceRef | null {
  const text = input.trim()

  const spotifyUri = text.match(/spotify:playlist:([A-Za-z0-9]{22})/)
  if (spotifyUri) return { service: 'spotify', id: spotifyUri[1] }

  const link = text.match(/https?:\/\/\S+/)?.[0]
  if (!link) return null

  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  const segments = url.pathname.split('/').filter(Boolean)

  let ref: SourceRef | null = null
  if (host === 'tidal.com' || host === 'listen.tidal.com') {
    // tidal.com/playlist/<uuid>, tidal.com/browse/playlist/<uuid>
    const i = segments.indexOf('playlist')
    if (i !== -1 && segments[i + 1]) ref = { service: 'tidal', id: segments[i + 1] }
  } else if (host === 'open.spotify.com') {
    // open.spotify.com/playlist/<id>, open.spotify.com/intl-de/playlist/<id>
    const i = segments.indexOf('playlist')
    if (i !== -1 && segments[i + 1]) ref = { service: 'spotify', id: segments[i + 1] }
  } else if (host === 'music.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com') {
    // …/playlist?list=<id> or …/watch?v=…&list=<id>
    const list = url.searchParams.get('list')
    if (list) ref = { service: 'youtube', id: list }
  }

  return ref && ID_PATTERNS[ref.service].test(ref.id) ? ref : null
}
