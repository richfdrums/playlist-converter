import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Spotify rejects "localhost" redirect URIs, so dev runs on the loopback IP.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Playlist Converter',
        short_name: 'Playlists',
        description: 'Convert playlists between Tidal, Spotify and YouTube Music.',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android: lets people "Share" a playlist link from a music app into this one.
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
      },
      workbox: {
        // Never serve API calls or OAuth callbacks from the cache.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
