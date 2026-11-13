// Bindings and secrets available to the Worker (see wrangler.jsonc and .dev.vars.example).
export interface Env {
  ASSETS: Fetcher
  API_RATE_LIMITER: RateLimit
  SEARCH_RATE_LIMITER: RateLimit
  TIDAL_CLIENT_ID: string
  TIDAL_CLIENT_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  YOUTUBE_API_KEY: string
}

/** Thrown by route handlers to return a specific HTTP status with a user-readable message. */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
