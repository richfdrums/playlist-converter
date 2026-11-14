# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev          # Vite dev server + Worker (via @cloudflare/vite-plugin) at http://127.0.0.1:5173
npm test             # Vitest, all tests once
npx vitest run src/lib/matching.test.ts      # one file
npx vitest run -t "rejects malformed"        # tests matching a name
npm run lint         # oxlint
npm run format       # Prettier
npm run build        # tsc -b (app, node and worker projects) + vite build
npm run deploy       # build + wrangler deploy
```

Dev must run on `127.0.0.1`, not `localhost` — Spotify rejects `localhost` redirect URIs (`strictPort` is on).
Local config: `.env` holds public `VITE_*` client IDs (baked into the bundle); `.dev.vars` holds Worker
secrets. See the `.example` files.

## Architecture

A React 19 PWA and a Cloudflare Worker served from **one origin** (`wrangler.jsonc`). Only `/api/*` reaches the
Worker; every other path is a static asset with SPA fallback (so `/callback` and `/share` are client routes).

- `shared/` — types (`Track`, `SourcePlaylist`, `ServiceId`) and URL/ID parsers used by both sides.
  Covered by `tsconfig.app.json` and `tsconfig.worker.json`, so it must stay free of DOM- and Workers-only APIs.
- `worker/` — reads **source** playlists and holds secrets. `index.ts` enforces same-origin (`Origin` or
  `Sec-Fetch-Site`, so bare curl gets 403), per-IP rate limits (separate, roomier limiter for
  `/api/tidal/tracks`), and validates playlist IDs against `ID_PATTERNS` before any upstream call.
  Errors are thrown as `HttpError` and turned into `{ error }` JSON.
- `src/services/` — one `Destination` per service (`types.ts`): OAuth config, `findCandidates`,
  `createPlaylist`, `searchConcurrency`, optional `quotaCost`. `registry.ts` wires them together.
  Writing to the destination happens **in the browser** with the user's own token.
- `src/lib/oauth.ts` — PKCE flow; tokens live in `localStorage` (survives iOS Safari ↔ installed-app
  bouncing). Google is the exception: its token exchange goes through `/api/google/token` because it
  needs a client secret. Spotify/TIDAL tokens never reach the Worker.
- TIDAL catalog search goes through the Worker (`/api/tidal/tracks`, using the app's client-credentials
  token); only TIDAL playlist creation uses the user's token.
- `src/lib/matching.ts` — ISRC exact match when the source provides one, else title/artist search scored
  on title, artist and duration. In `findMatches`, 401/403 aborts the whole run; other per-track errors
  just drop that track.
- `src/hooks/useConversion.ts` — the conversion state machine (`useReducer`): load → match → review
  (toggle) → create.
- `src/lib/pending.ts` — OAuth sign-in navigates away and loses React state, so the in-progress URL and
  destination are stashed in `localStorage` and resumed on return.

### Adding a service

Add its `ServiceId` in `shared/types.ts`, its `ID_PATTERNS` entry and link parsing in `shared/urls.ts`, a Worker playlist reader
registered in `playlistReaders` (`worker/index.ts`), and a `Destination` registered in
`src/services/registry.ts`.

## Constraints to keep in mind

- Spotify as a source is read from its public embed page (no official API access to others' playlists):
  no ISRCs, capped at 100 tracks (`truncated: true`).
- YouTube Data API quota is 10,000 units/day total; writing costs ~150 units per track. No ISRC search.
- Spotify dev mode: max 5 hand-added users. Apple Music is intentionally not implemented.
- Tests live beside the code as `*.test.ts` in `src/`, `shared/`, `worker/`. `vitest.config.ts` is separate
  from `vite.config.ts` so tests don't load the Cloudflare/PWA plugins.
- The PWA service worker must never cache `/api/*` (`navigateFallbackDenylist` in `vite.config.ts`).
