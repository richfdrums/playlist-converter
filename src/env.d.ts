/// <reference types="vite-plugin-pwa/client" />

// Public OAuth client IDs, read from .env at build time (see .env.example).
interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID: string
  readonly VITE_TIDAL_CLIENT_ID: string
  readonly VITE_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
