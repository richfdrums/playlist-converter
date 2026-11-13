import { parseIsoDuration } from '../../shared/iso8601'
import { parseYouTubeTitle } from '../../shared/youtubeTitle'
import { fetchJson } from '../lib/http'
import { searchTerms } from './searchQuery'
import type { Destination } from './types'

const API = 'https://www.googleapis.com/youtube/v3'

// YouTube Data API quota costs (units), from Google's quota calculator. The default budget is 10,000/day.
const COST = { search: 100, videosList: 1, playlistInsert: 50, playlistItemInsert: 50 }

interface Video {
  id: string
  snippet: { title: string; channelTitle: string }
  contentDetails: { duration: string }
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

export const youtube: Destination = {
  id: 'youtube',
  label: 'YouTube Music',
  searchConcurrency: 2,
  oauth: {
    service: 'youtube',
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    // Google needs the client secret to issue tokens, so our Worker completes the exchange.
    tokenUrl: '/api/google/token',
    tokenBody: 'json',
    scopes: ['https://www.googleapis.com/auth/youtube'],
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' },
  },

  quotaCost(trackCount) {
    return (
      trackCount * (COST.search + COST.videosList + COST.playlistItemInsert) + COST.playlistInsert
    )
  },

  async findCandidates(track, token) {
    const { title, artist } = searchTerms(track)
    const params = new URLSearchParams({
      part: 'id',
      type: 'video',
      videoCategoryId: '10', // Music
      maxResults: '5',
      q: `${artist} ${title}`,
    })
    const results = await fetchJson<{ items: { id: { videoId: string } }[] }>(
      `${API}/search?${params}`,
      { headers: auth(token) },
    )
    if (!results.items.length) return []

    // Search results lack durations, so look the videos up (1 unit for all of them).
    const ids = results.items.map((item) => item.id.videoId).join(',')
    const videos = await fetchJson<{ items: Video[] }>(
      `${API}/videos?part=snippet,contentDetails&id=${ids}`,
      { headers: auth(token) },
    )
    return videos.items.map((video) => ({
      id: video.id,
      url: `https://music.youtube.com/watch?v=${video.id}`,
      ...parseYouTubeTitle(video.snippet.title, video.snippet.channelTitle),
      durationMs: parseIsoDuration(video.contentDetails.duration),
    }))
  },

  async createPlaylist(token, name, description, trackIds) {
    const playlist = await fetchJson<{ id: string }>(`${API}/playlists?part=snippet,status`, {
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippet: { title: name, description },
        status: { privacyStatus: 'private' },
      }),
    })
    // One video per request, in order; parallel inserts can land out of order.
    for (const videoId of trackIds) {
      await fetchJson(`${API}/playlistItems?part=snippet`, {
        method: 'POST',
        headers: { ...auth(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snippet: { playlistId: playlist.id, resourceId: { kind: 'youtube#video', videoId } },
        }),
      })
    }
    return `https://music.youtube.com/playlist?list=${playlist.id}`
  },
}
