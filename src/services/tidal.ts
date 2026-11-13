import { chunk, fetchJson } from '../lib/http'
import type { Candidate } from '../lib/matching'
import { searchTerms } from './searchQuery'
import type { Destination } from './types'

const API = 'https://openapi.tidal.com/v2'

// Catalog lookups go through our Worker (see worker/routes/tidalSearch.ts);
// only playlist creation uses the user's own Tidal token.
const searchCatalog = (params: Record<string, string>) =>
  fetchJson<Candidate[]>(`/api/tidal/tracks?${new URLSearchParams(params)}`)

const jsonApiHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/vnd.api+json',
  Accept: 'application/vnd.api+json',
})

export const tidal: Destination = {
  id: 'tidal',
  label: 'TIDAL',
  searchConcurrency: 3,
  oauth: {
    service: 'tidal',
    clientId: import.meta.env.VITE_TIDAL_CLIENT_ID,
    authorizeUrl: 'https://login.tidal.com/authorize',
    tokenUrl: 'https://auth.tidal.com/v1/oauth2/token',
    tokenBody: 'form',
    scopes: ['playlists.write'],
  },

  async findCandidates(track) {
    if (track.isrc) {
      const byIsrc = await searchCatalog({ isrc: track.isrc })
      if (byIsrc.length) return byIsrc
    }
    const { title, artist } = searchTerms(track)
    return searchCatalog({ q: `${title} ${artist}` })
  },

  async createPlaylist(token, name, description, trackIds) {
    const playlist = await fetchJson<{ data: { id: string } }>(`${API}/playlists`, {
      method: 'POST',
      headers: jsonApiHeaders(token),
      body: JSON.stringify({
        data: { type: 'playlists', attributes: { name, description, accessType: 'UNLISTED' } },
      }),
    })
    const id = playlist.data.id
    // The API accepts at most 50 items per request.
    for (const ids of chunk(trackIds, 50)) {
      await fetchJson(`${API}/playlists/${id}/relationships/items`, {
        method: 'POST',
        headers: jsonApiHeaders(token),
        body: JSON.stringify({ data: ids.map((trackId) => ({ id: trackId, type: 'tracks' })) }),
      })
    }
    return `https://tidal.com/playlist/${id}`
  },
}
