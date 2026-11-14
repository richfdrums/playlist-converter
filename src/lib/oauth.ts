import type { ServiceId } from '../../shared/types'
import { fetchJson } from './http'

/** Everything needed to sign a user in to one service with OAuth 2.0 + PKCE. */
export interface OAuthProvider {
  service: ServiceId
  clientId: string
  authorizeUrl: string
  /** Called directly from the browser, or our Worker for providers that require a client secret (Google). */
  tokenUrl: string
  /** How the token endpoint wants its body: form-encoded (standard) or JSON (our Worker). */
  tokenBody: 'form' | 'json'
  scopes: string[]
  extraAuthorizeParams?: Record<string, string>
}

interface StoredToken {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

const tokenKey = (service: ServiceId) => `token:${service}`
const loginKey = (state: string) => `oauth-login:${state}`

export const redirectUri = () => `${window.location.origin}/callback`

// localStorage (not sessionStorage) so the login survives iOS bouncing between Safari and the installed app.
function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function randomString(byteLength = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return base64Url(new Uint8Array(digest))
}

/** Sends the browser to the provider's login page. The page unloads, and we resume on /callback. */
export async function startLogin(provider: OAuthProvider): Promise<void> {
  if (!provider.clientId)
    throw new Error(`No client ID configured for ${provider.service} (see .env.example).`)
  const state = randomString(16)
  const verifier = randomString(64)
  localStorage.setItem(loginKey(state), JSON.stringify({ service: provider.service, verifier }))

  const params = new URLSearchParams({
    client_id: provider.clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: provider.scopes.join(' '),
    state,
    code_challenge_method: 'S256',
    code_challenge: await sha256(verifier),
    ...provider.extraAuthorizeParams,
  })
  window.location.assign(`${provider.authorizeUrl}?${params}`)
}

/** Finishes a login on the /callback page. Returns which service was signed in to. */
export async function completeLogin(
  query: URLSearchParams,
  providers: Record<ServiceId, OAuthProvider>,
): Promise<ServiceId> {
  const error = query.get('error')
  if (error) throw new Error(error === 'access_denied' ? 'Sign-in was cancelled.' : error)

  const state = query.get('state') ?? ''
  const pending = readJson<{ service: ServiceId; verifier: string }>(loginKey(state))
  if (!pending) {
    throw new Error(
      'This sign-in started in a different browser or app. Please open the converter again and retry.',
    )
  }
  localStorage.removeItem(loginKey(state))

  const provider = providers[pending.service]
  const token = await requestToken(provider, {
    grant_type: 'authorization_code',
    code: query.get('code') ?? '',
    redirect_uri: redirectUri(),
    code_verifier: pending.verifier,
  })
  saveToken(provider.service, token)
  return provider.service
}

/** Returns a valid access token, refreshing it if it's about to expire, or null if signed out. */
export async function getAccessToken(provider: OAuthProvider): Promise<string | null> {
  const stored = readJson<StoredToken>(tokenKey(provider.service))
  if (!stored) return null
  if (stored.expiresAt > Date.now() + 60_000) return stored.accessToken
  if (!stored.refreshToken) return null

  try {
    const token = await requestToken(provider, {
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
    })
    // Some providers don't send a new refresh token; keep the old one.
    saveToken(provider.service, { refresh_token: stored.refreshToken, ...token })
    return token.access_token
  } catch {
    logout(provider.service)
    return null
  }
}

export function isLoggedIn(service: ServiceId): boolean {
  return readJson<StoredToken>(tokenKey(service)) !== null
}

export function logout(service: ServiceId): void {
  localStorage.removeItem(tokenKey(service))
}

function requestToken(provider: OAuthProvider, params: Record<string, string>) {
  const body = { client_id: provider.clientId, ...params }
  return fetchJson<TokenResponse>(
    provider.tokenUrl,
    provider.tokenBody === 'json'
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : { method: 'POST', body: new URLSearchParams(body) },
  )
}

function saveToken(service: ServiceId, token: TokenResponse): void {
  const stored: StoredToken = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  }
  localStorage.setItem(tokenKey(service), JSON.stringify(stored))
}
