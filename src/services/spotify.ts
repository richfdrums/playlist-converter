import { chunk, fetchJson } from '../lib/http'
import type { Candidate } from '../lib/matching'
import { searchTerms } from './searchQuery'
import type { Destination } from './types'

const API = 'https://api.spotify.com/v1'

interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  duration_ms: number
  external_ids?: { isrc?: string }
  external_urls: { spotify: string }
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function search(token: string, q: string): Promise<Candidate[]> {
  // Development-mode apps may request at most 10 results.
  const params = new URLSearchParams({ q, type: 'track', limit: '10' })
  const body = await fetchJson<{ tracks: { items: SpotifyTrack[] } }>(`${API}/search?${params}`, {
    headers: auth(token),
  })
  return body.tracks.items.map((t) => ({
    id: t.id,
    url: t.external_urls.spotify,
    title: t.name,
    artists: t.artists.map((a) => a.name),
    durationMs: t.duration_ms,
    isrc: t.external_ids?.isrc,
  }))
}

export const spotify: Destination = {
  id: 'spotify',
  label: 'Spotify',
  searchConcurrency: 4,
  oauth: {
    service: 'spotify',
    clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
    authorizeUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    tokenBody: 'form',
    scopes: ['playlist-modify-private', 'playlist-modify-public'],
  },

  async findCandidates(track, token) {
    // An ISRC search pinpoints the exact recording when the source gave us one.
    if (track.isrc) {
      const byIsrc = await search(token, `isrc:${track.isrc}`)
      if (byIsrc.length) return byIsrc
    }
    const { title, artist } = searchTerms(track)
    const byFields = await search(token, `track:${title} artist:${artist}`)
    return byFields.length ? byFields : search(token, `${title} ${artist}`)
  },

  async createPlaylist(token, name, description, trackIds) {
    const playlist = await fetchJson<{ id: string; external_urls: { spotify: string } }>(
      `${API}/me/playlists`,
      {
        method: 'POST',
        headers: { ...auth(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, public: false }),
      },
    )
    // Up to 100 tracks per request; sequential so the order is preserved.
    for (const ids of chunk(trackIds, 100)) {
      await fetchJson(`${API}/playlists/${playlist.id}/items`, {
        method: 'POST',
        headers: { ...auth(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: ids.map((id) => `spotify:track:${id}`) }),
      })
    }
    return playlist.external_urls.spotify
  },
}
