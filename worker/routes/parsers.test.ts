import { describe, expect, it } from 'vitest'
import { parseSpotifyEmbed } from './spotify'
import { toTracks } from './tidal'

describe('parseSpotifyEmbed', () => {
  it('reads the playlist entity from __NEXT_DATA__', () => {
    const entity = {
      name: 'Road Trip',
      trackList: [
        { uri: 'spotify:track:1', title: 'Song', subtitle: 'A,\u00a0B', duration: 200_000 },
      ],
    }
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: { pageProps: { state: { data: { entity } } } },
    })}</script></html>`
    expect(parseSpotifyEmbed(html)).toEqual(entity)
  })

  it('throws when the page layout changes', () => {
    expect(() => parseSpotifyEmbed('<html></html>')).toThrow(/Could not read/)
  })
})

describe('Tidal toTracks', () => {
  it('joins tracks with their included artists and folds the version into the title', () => {
    const tracks = toTracks({
      data: [
        {
          id: '42',
          type: 'tracks',
          attributes: { title: 'Halo', version: 'Live', isrc: 'USSM10804554', duration: 'PT4M21S' },
          relationships: { artists: { data: [{ id: '7', type: 'artists' }] } },
        },
      ],
      included: [{ id: '7', type: 'artists', attributes: { name: 'Beyoncé' } }],
    })
    expect(tracks).toEqual([
      [
        '42',
        { title: 'Halo (Live)', artists: ['Beyoncé'], isrc: 'USSM10804554', durationMs: 261_000 },
      ],
    ])
  })
})
