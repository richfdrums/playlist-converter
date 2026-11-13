// Types shared by the browser app and the Cloudflare Worker.

export type ServiceId = 'tidal' | 'spotify' | 'youtube'

/** A service-neutral description of one song, used for matching across services. */
export interface Track {
  title: string
  artists: string[]
  album?: string
  durationMs?: number
  /** International Standard Recording Code — identical across services when present. */
  isrc?: string
}

/** A playlist read from the source service, as returned by the Worker's /api/<service>/playlist/:id routes. */
export interface SourcePlaylist {
  service: ServiceId
  id: string
  name: string
  description?: string
  tracks: Track[]
  /** Set when the source only exposed part of the playlist (e.g. Spotify's embed page caps at 100). */
  truncated?: boolean
}

/** Error body returned by the Worker on failure. */
export interface ApiError {
  error: string
}
