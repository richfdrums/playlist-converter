import { parseIsoDuration } from '../../shared/iso8601'
import type { SourcePlaylist, Track } from '../../shared/types'
import { parseYouTubeTitle } from '../../shared/youtubeTitle'
import { HttpError, type Env } from '../env'

const API = 'https://www.googleapis.com/youtube/v3'
const MAX_ITEMS = 1000

interface ListResponse<T> {
  items: T[]
  nextPageToken?: string
}
interface PlaylistItem {
  contentDetails: { videoId: string }
}
interface Video {
  id: string
  snippet: { title: string; channelTitle: string }
  contentDetails: { duration: string }
}

async function youtubeGet<T>(env: Env, path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ ...params, key: env.YOUTUBE_API_KEY })
  const res = await fetch(`${API}/${path}?${query}`)
  if (res.status === 404) throw new HttpError(404, 'YouTube playlist not found (is it public?)')
  if (!res.ok) throw new HttpError(502, `YouTube API error (${res.status})`)
  return res.json()
}

// Reading costs 1 quota unit per request (50 items each), so this is cheap.
export async function getYouTubePlaylist(env: Env, id: string): Promise<SourcePlaylist> {
  const meta = await youtubeGet<ListResponse<{ snippet: { title: string; description: string } }>>(
    env,
    'playlists',
    { part: 'snippet', id },
  )
  if (!meta.items.length) throw new HttpError(404, 'YouTube playlist not found (is it public?)')

  const videoIds: string[] = []
  let pageToken: string | undefined
  do {
    const page = await youtubeGet<ListResponse<PlaylistItem>>(env, 'playlistItems', {
      part: 'contentDetails',
      playlistId: id,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    })
    videoIds.push(...page.items.map((item) => item.contentDetails.videoId))
    pageToken = page.nextPageToken
  } while (pageToken && videoIds.length < MAX_ITEMS)

  // videos.list gives us durations and the uploading channel; deleted/private videos are simply absent.
  const videos = new Map<string, Video>()
  for (let i = 0; i < videoIds.length; i += 50) {
    const page = await youtubeGet<ListResponse<Video>>(env, 'videos', {
      part: 'snippet,contentDetails',
      id: videoIds.slice(i, i + 50).join(','),
    })
    for (const video of page.items) videos.set(video.id, video)
  }

  const { title, description } = meta.items[0].snippet
  return {
    service: 'youtube',
    id,
    name: title,
    description: description || undefined,
    tracks: videoIds.flatMap((videoId) => {
      const video = videos.get(videoId)
      return video ? [toTrack(video)] : []
    }),
    truncated: Boolean(pageToken),
  }
}

function toTrack(video: Video): Track {
  return {
    ...parseYouTubeTitle(video.snippet.title, video.snippet.channelTitle),
    durationMs: parseIsoDuration(video.contentDetails.duration),
  }
}
