import type { ServiceId, Track } from '../../shared/types'
import type { Candidate } from '../lib/matching'
import type { OAuthProvider } from '../lib/oauth'

/**
 * A service we can write playlists to. Each one knows how to sign the user in,
 * search its catalog for a track, and create a playlist from track IDs.
 */
export interface Destination {
  id: ServiceId
  label: string
  oauth: OAuthProvider
  /** How many catalog searches to run in parallel without tripping rate limits. */
  searchConcurrency: number
  /** Possible matches for `track` in this service's catalog. Matching logic decides which (if any) wins. */
  findCandidates(track: Track, token: string): Promise<Candidate[]>
  /** Creates a playlist in the signed-in user's account and returns a link to it. */
  createPlaylist(
    token: string,
    name: string,
    description: string,
    trackIds: string[],
  ): Promise<string>
  /** API quota units a conversion of `trackCount` tracks will use, for services with a daily quota. */
  quotaCost?(trackCount: number): number
}
