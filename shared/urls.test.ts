import { describe, expect, it } from 'vitest'
import { parseSourceUrl } from './urls'

const TIDAL_ID = '1b5a9c3e-8f2d-4a6b-9c1e-2d3f4a5b6c7d'

describe('parseSourceUrl', () => {
  it.each([
    [`https://tidal.com/playlist/${TIDAL_ID}`, 'tidal', TIDAL_ID],
    [`https://tidal.com/browse/playlist/${TIDAL_ID}?u`, 'tidal', TIDAL_ID],
    [`https://listen.tidal.com/playlist/${TIDAL_ID}`, 'tidal', TIDAL_ID],
    [
      'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc',
      'spotify',
      '37i9dQZF1DXcBWIGoYBM5M',
    ],
    [
      'https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M',
      'spotify',
      '37i9dQZF1DXcBWIGoYBM5M',
    ],
    ['spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', 'spotify', '37i9dQZF1DXcBWIGoYBM5M'],
    [
      'https://music.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
      'youtube',
      'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    ],
    [
      'https://www.youtube.com/watch?v=abc&list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
      'youtube',
      'PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI',
    ],
  ])('parses %s', (input, service, id) => {
    expect(parseSourceUrl(input)).toEqual({ service, id })
  })

  it('finds a link inside shared text', () => {
    expect(parseSourceUrl(`Listen to this! https://tidal.com/playlist/${TIDAL_ID} 🎶`)).toEqual({
      service: 'tidal',
      id: TIDAL_ID,
    })
  })

  it.each([
    '',
    'not a link',
    'https://tidal.com/album/12345',
    'https://open.spotify.com/track/37i9dQZF1DXcBWIGoYBM5M',
    'https://open.spotify.com/playlist/tooShort',
    'https://example.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  ])('rejects %j', (input) => {
    expect(parseSourceUrl(input)).toBeNull()
  })
})
