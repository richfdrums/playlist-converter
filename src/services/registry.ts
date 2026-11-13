import type { ServiceId, SourcePlaylist, Track } from '../../shared/types'
import type { SourceRef } from '../../shared/urls'
import { fetchJson, HttpError, mapWithConcurrency } from '../lib/http'
import { pickBestMatch, type Candidate, type MatchResult } from '../lib/matching'
import type { OAuthProvider } from '../lib/oauth'
import { spotify } from './spotify'
import { tidal } from './tidal'
import type { Destination } from './types'
import { youtube } from './youtube'

// To add a service (e.g. Apple Music): add its ServiceId, a Worker playlist reader,
// and a Destination implementation, then register it here.
export const destinations: Record<ServiceId, Destination> = { spotify, tidal, youtube }

export const oauthProviders = Object.fromEntries(
  Object.values(destinations).map((d) => [d.id, d.oauth]),
) as Record<ServiceId, OAuthProvider>

export const serviceLabel = (service: ServiceId) => destinations[service].label

/** Reads a public playlist via our Worker. */
export function fetchSourcePlaylist(ref: SourceRef): Promise<SourcePlaylist> {
  return fetchJson<SourcePlaylist>(`/api/${ref.service}/playlist/${encodeURIComponent(ref.id)}`)
}

/** Searches `destination` for every track and picks the best match for each. */
export function findMatches(
  destination: Destination,
  tracks: Track[],
  token: string,
  onProgress: (completed: number) => void,
): Promise<MatchResult[]> {
  let completed = 0
  return mapWithConcurrency(tracks, destination.searchConcurrency, async (track) => {
    let candidates: Candidate[]
    try {
      candidates = await destination.findCandidates(track, token)
    } catch (err) {
      // Auth and quota problems affect every track, so stop. Anything else just loses this one track.
      if (err instanceof HttpError && [401, 403].includes(err.status)) throw err
      candidates = []
    }
    onProgress(++completed)
    return pickBestMatch(track, candidates)
  })
}
