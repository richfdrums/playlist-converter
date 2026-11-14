import { describe, expect, it, vi } from 'vitest'
import type { Env } from './env'
import worker from './index'

const allow = { limit: vi.fn(async () => ({ success: true })) }
const deny = { limit: vi.fn(async () => ({ success: false })) }
const env = (limiter = allow) =>
  ({ API_RATE_LIMITER: limiter, SEARCH_RATE_LIMITER: limiter }) as unknown as Env

const call = (path: string, headers: Record<string, string> = {}, e = env()) =>
  worker.fetch(new Request(`https://app.example${path}`, { headers }), e)

const sameOrigin = { 'Sec-Fetch-Site': 'same-origin' }

describe('worker /api guardrails', () => {
  it('refuses requests without browser same-origin headers (e.g. curl)', async () => {
    expect((await call('/api/spotify/playlist/37i9dQZF1DXcBWIGoYBM5M')).status).toBe(403)
  })

  it('refuses cross-origin requests', async () => {
    const res = await call('/api/spotify/playlist/37i9dQZF1DXcBWIGoYBM5M', {
      Origin: 'https://evil.example',
    })
    expect(res.status).toBe(403)
  })

  it('rejects malformed playlist IDs before calling upstream', async () => {
    const res = await call('/api/tidal/playlist/not-a-uuid', sameOrigin)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid playlist ID' })
  })

  it('returns 429 when rate limited', async () => {
    expect((await call('/api/tidal/playlist/x', sameOrigin, env(deny))).status).toBe(429)
  })

  it('returns 404 for unknown routes', async () => {
    expect((await call('/api/nope', sameOrigin)).status).toBe(404)
  })
})
