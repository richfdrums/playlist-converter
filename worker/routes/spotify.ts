import type { SourcePlaylist, Track } from '../../shared/types'
import { HttpError, type Env } from '../env'

// Spotify's Web API (development mode) won't list tracks of playlists the user doesn't own,
// so we read the public embed player page instead. It's unofficial and capped at 100 tracks.
const EMBED_LIMIT = 100

interface EmbedTrack {
  uri: string
  title: string
  subtitle: string
  duration: number
}
interface EmbedEntity {
  name: string
  trackList: EmbedTrack[]
}

export async function getSpotifyPlaylist(_env: Env, id: string): Promise<SourcePlaylist> {
  const res = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; playlist-converter)' },
  })
  if (res.status === 404) throw new HttpError(404, 'Spotify playlist not found (is it public?)')
  if (!res.ok) throw new HttpError(502, `Spotify embed error (${res.status})`)

  const entity = parseSpotifyEmbed(await res.text())
  return {
    service: 'spotify',
    id,
    name: entity.name,
    tracks: entity.trackList.map(toTrack),
    truncated: entity.trackList.length >= EMBED_LIMIT,
  }
}

export function parseSpotifyEmbed(html: string): EmbedEntity {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  if (!match) throw new HttpError(502, 'Could not read Spotify playlist page')
  const entity = JSON.parse(match[1])?.props?.pageProps?.state?.data?.entity
  if (!entity?.trackList) throw new HttpError(502, 'Spotify playlist page had no track list')
  return entity
}

function toTrack(t: EmbedTrack): Track {
  return {
    title: t.title,
    // Artists arrive as "Artist A,<non-breaking space>Artist B".
    artists: t.subtitle.split(',').map((name) => name.replace(/\u00a0/g, ' ').trim()),
    durationMs: t.duration,
  }
}
