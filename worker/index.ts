import type { ServiceId, SourcePlaylist } from '../shared/types'
import { ID_PATTERNS } from '../shared/urls'
import { HttpError, type Env } from './env'
import { exchangeGoogleToken } from './routes/google'
import { getSpotifyPlaylist } from './routes/spotify'
import { getTidalPlaylist } from './routes/tidal'
import { searchTidalTracks } from './routes/tidalSearch'
import { getYouTubePlaylist } from './routes/youtube'

const playlistReaders: Record<ServiceId, (env: Env, id: string) => Promise<SourcePlaylist>> = {
  tidal: getTidalPlaylist,
  spotify: getSpotifyPlaylist,
  youtube: getYouTubePlaylist,
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await handleApi(request, env)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      console.error(err)
      return json({ error: 'Unexpected server error' }, 500)
    }
  },
} satisfies ExportedHandler<Env>

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)

  // The PWA and the API share one origin, so anything cross-site (or a bare curl) is refused.
  if (!isSameOrigin(request, url)) throw new HttpError(403, 'Forbidden')

  // Track searches happen once per song, so they get a roomier limit than everything else.
  const isSearch = url.pathname === '/api/tidal/tracks'
  const limiter = isSearch ? env.SEARCH_RATE_LIMITER : env.API_RATE_LIMITER
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
  const { success } = await limiter.limit({ key: ip })
  if (!success) throw new HttpError(429, 'Too many requests — try again in a minute.')

  if (isSearch && request.method === 'GET') {
    return json(await searchTidalTracks(env, url))
  }

  const playlistRoute = url.pathname.match(/^\/api\/(tidal|spotify|youtube)\/playlist\/([^/]+)$/)
  if (playlistRoute && request.method === 'GET') {
    const service = playlistRoute[1] as ServiceId
    const id = decodeURIComponent(playlistRoute[2])
    if (!ID_PATTERNS[service].test(id)) throw new HttpError(400, 'Invalid playlist ID')
    return json(await playlistReaders[service](env, id))
  }

  if (url.pathname === '/api/google/token' && request.method === 'POST') {
    return json(await exchangeGoogleToken(request, env, url.origin))
  }

  throw new HttpError(404, 'Not found')
}

function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('Origin')
  if (origin) return origin === url.origin
  // Browsers omit Origin on same-origin GETs but always send Sec-Fetch-Site.
  return request.headers.get('Sec-Fetch-Site') === 'same-origin'
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}
