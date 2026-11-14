# Playlist Converter

A small PWA that converts playlists between **TIDAL**, **Spotify** and **YouTube Music**, in any direction.
Paste (or, on Android, share) a public playlist link, connect the service you want it on, review the
matches, and the app creates the playlist in your account.

Completely, unabashedly vibe coded with our pal Claude.

## How it works

```
Browser (React PWA)                          Cloudflare Worker (/api/*)
- detects the source from the link           - holds the secrets
- signs you in to the destination (PKCE)     - GET  /api/tidal/playlist/:id     (TIDAL app token)
- searches the destination for each track    - GET  /api/tidal/tracks?isrc|q    (TIDAL catalog search)
- you review matches, it creates the         - GET  /api/spotify/playlist/:id   (public embed page)
  playlist in *your* account                 - GET  /api/youtube/playlist/:id   (API key)
                                             - POST /api/google/token           (adds client secret)
```

- **Your sign-in tokens stay on your device.** The Worker never sees Spotify or TIDAL tokens.
  Google tokens pass through it once during sign-in, because Google requires a client secret.
- **Matching:** when the source provides an ISRC (a standard recording ID, which TIDAL gives), the app
  searches the destination by ISRC for an exact hit. Otherwise it searches by title and artist, then
  scores the candidates on title, artist and duration (`src/lib/matching.ts`).
- **Review:** exact and likely matches are pre-ticked. Unsure ones are left for you to decide.

### Code map

| Path                                    | What's there                                                          |
| --------------------------------------- | --------------------------------------------------------------------- |
| `shared/`                               | Types and parsers used by both the app and the Worker                 |
| `worker/`                               | The Cloudflare Worker: routes, guardrails (same-origin, rate limits) |
| `src/services/`                         | One `Destination` per service, plus `registry.ts` tying them together |
| `src/lib/`                              | Matching, OAuth/PKCE, HTTP helpers                                    |
| `src/hooks/useConversion.ts`            | The conversion state machine (`useReducer`)                           |
| `src/routes/`, `src/components/`        | The UI                                                                |

## Known limits

- **Spotify (development mode):** your Spotify app works for at most **5 users**, whom you add by
  hand, and the app owner needs **Premium**.
- **Spotify as a source:** the official API won't list tracks of playlists you don't own, so the app
  reads Spotify's public embed page instead. That's unofficial, gives no ISRCs, and stops at
  **100 tracks**.
- **YouTube:** the Data API allows **10,000 units/day** for everyone combined. Converting _into_
  YouTube costs about 150 units per track, so roughly one or two playlists a day. Reading _from_
  YouTube is cheap. YouTube has no ISRC search, so matching there is by title and artist only.
- **Apple Music** isn't supported yet (it needs a paid Apple Developer membership). The `Destination`
  interface is ready for it.
- **iOS home-screen app:** if signing in bounces you to Safari and fails, use the converter in a
  normal Safari tab instead.

## Setup

### 1. Register the apps

Use these redirect URIs everywhere: `http://127.0.0.1:5173/callback` (local dev) and
`https://<your-worker>.workers.dev/callback` (production). Spotify doesn't accept `localhost`.

- **Spotify** — [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
  1. Create an app with the **Web API** enabled, and add both redirect URIs.
  2. Under **User Management**, add each person's name and Spotify account email.
  3. Copy the **Client ID**.
- **TIDAL** — [developer.tidal.com](https://developer.tidal.com)
  1. Create an app, add both redirect URIs, and enable the `playlists.write` scope.
  2. Copy the **Client ID** and **Client Secret**.
- **Google / YouTube** — [console.cloud.google.com](https://console.cloud.google.com)
  1. Create a project and enable **YouTube Data API v3**.
  2. Set the OAuth consent screen to **Testing** and add each person as a test user.
  3. Create an **OAuth client ID** (type: Web application) with both redirect URIs.
  4. Create an **API key** restricted to the YouTube Data API.

### 2. Local config

```sh
cp .env.example .env              # public client IDs (Spotify, TIDAL, Google)
cp .dev.vars.example .dev.vars    # secrets for the Worker
npm install
npm run dev                       # http://127.0.0.1:5173
```

### 3. Deploy to Cloudflare

```sh
npx wrangler login
npx wrangler secret put TIDAL_CLIENT_ID      # repeat for each name in .dev.vars.example
npm run deploy
```

Then add the deployed `/callback` URL to all three developer consoles, if you haven't already.

### 4. Install on phones

- **iPhone:** open the URL in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open it in Chrome and tap **Install**. The converter then appears in the share sheet,
  so you can share a playlist from TIDAL, Spotify or YouTube Music straight into it.

## Scripts

| Command          | Does                                  |
| ---------------- | ------------------------------------- |
| `npm run dev`    | Vite dev server with the Worker       |
| `npm test`       | Unit tests (Vitest)                   |
| `npm run lint`   | oxlint                                |
| `npm run format` | Prettier                              |
| `npm run build`  | Type-check and build                  |
| `npm run deploy` | Build and deploy to Cloudflare        |
