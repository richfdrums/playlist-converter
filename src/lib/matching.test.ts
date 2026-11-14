import { describe, expect, it } from 'vitest'
import type { Track } from '../../shared/types'
import { normalize, pickBestMatch, scoreCandidate, similarity, type Candidate } from './matching'

const track = (title: string, artists: string[], extra: Partial<Track> = {}): Track => ({
  title,
  artists,
  ...extra,
})
const candidate = (id: string, t: Track): Candidate => ({ id, ...t })

describe('normalize', () => {
  it.each([
    ['Get Lucky (feat. Pharrell Williams)', 'get lucky'],
    ['Get Lucky feat. Pharrell Williams', 'get lucky'],
    ['Here Comes the Sun - Remastered 2009', 'here comes the sun'],
    ['Heroes (2017 Remaster)', 'heroes'],
    ['Bad Guy (Official Music Video)', 'bad guy'],
    ['Beyoncé', 'beyonce'],
    ['Simon & Garfunkel', 'simon and garfunkel'],
  ])('%s → %s', (input, expected) => {
    expect(normalize(input)).toBe(expected)
  })

  it('keeps words that identify a different recording', () => {
    expect(normalize('Wonderwall (Live)')).toBe('wonderwall live')
  })
})

describe('similarity', () => {
  it('is 1 for identical and 0 for unrelated strings', () => {
    expect(similarity('night', 'night')).toBe(1)
    expect(similarity('abc', 'xyz')).toBe(0)
  })
  it('is high for near-identical strings', () => {
    expect(similarity('colour', 'color')).toBeGreaterThan(0.6)
  })
})

describe('scoreCandidate', () => {
  const source = track('Get Lucky (feat. Pharrell Williams)', ['Daft Punk', 'Pharrell Williams'], {
    durationMs: 248_000,
  })

  it('scores the same song on another service highly', () => {
    const other = track('Get Lucky', ['Daft Punk'], { durationMs: 248_500 })
    expect(scoreCandidate(source, other)).toBeGreaterThan(0.9)
  })

  it('scores a different song by the same artist low', () => {
    const other = track('One More Time', ['Daft Punk'], { durationMs: 320_000 })
    expect(scoreCandidate(source, other)).toBeLessThan(0.55)
  })
})

describe('pickBestMatch', () => {
  it('treats an ISRC match as exact even if metadata differs', () => {
    const source = track('Song', ['Artist'], { isrc: 'USABC1234567' })
    const result = pickBestMatch(source, [
      candidate('a', track('Song', ['Artist'])),
      candidate('b', track('Song - 2020 Mix', ['Artist'], { isrc: 'GBXYZ7654321' })),
      { ...candidate('c', track('Something else', ['Artist'])), isrc: 'usabc1234567' },
    ])
    expect(result).toMatchObject({ confidence: 'exact', candidate: { id: 'c' } })
  })

  it('picks the highest-scoring candidate', () => {
    const source = track('Dreams', ['Fleetwood Mac'], { durationMs: 257_000 })
    const result = pickBestMatch(source, [
      candidate('cover', track('Dreams', ['Karaoke Kings'], { durationMs: 250_000 })),
      candidate(
        'real',
        track('Dreams - 2004 Remaster', ['Fleetwood Mac'], { durationMs: 257_800 }),
      ),
    ])
    expect(result).toMatchObject({ confidence: 'high', candidate: { id: 'real' } })
  })

  it('reports none when there are no candidates', () => {
    expect(pickBestMatch(track('x', ['y']), [])).toMatchObject({ confidence: 'none', score: 0 })
  })
})
