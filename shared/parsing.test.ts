import { describe, expect, it } from 'vitest'
import { parseIsoDuration } from './iso8601'
import { parseYouTubeTitle } from './youtubeTitle'

describe('parseIsoDuration', () => {
  it.each([
    ['PT2M58S', 178_000],
    ['PT1H2M3S', 3_723_000],
    ['PT45.5S', 45_500],
    ['PT4M', 240_000],
    ['P0D', 0],
  ])('%s → %d ms', (input, ms) => {
    expect(parseIsoDuration(input)).toBe(ms)
  })

  it('returns undefined for missing or malformed input', () => {
    expect(parseIsoDuration(undefined)).toBeUndefined()
    expect(parseIsoDuration('3:20')).toBeUndefined()
  })
})

describe('parseYouTubeTitle', () => {
  it('uses the "- Topic" channel as the artist', () => {
    expect(parseYouTubeTitle('Dreams', 'Fleetwood Mac - Topic')).toEqual({
      title: 'Dreams',
      artists: ['Fleetwood Mac'],
    })
  })

  it('splits "Artist - Title" video titles', () => {
    expect(parseYouTubeTitle('Daft Punk – Get Lucky (Official Audio)', 'Daft Punk')).toEqual({
      title: 'Get Lucky (Official Audio)',
      artists: ['Daft Punk'],
    })
  })

  it('falls back to the channel name minus VEVO', () => {
    expect(parseYouTubeTitle('Rolling in the Deep', 'AdeleVEVO')).toEqual({
      title: 'Rolling in the Deep',
      artists: ['Adele'],
    })
  })
})
