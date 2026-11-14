import type { Track } from '../../shared/types'

/** A track found on the destination service, with its service-specific ID. */
export interface Candidate extends Track {
  id: string
  url?: string
}

export type Confidence = 'exact' | 'high' | 'low' | 'none'

export interface MatchResult {
  source: Track
  /** Best candidate found, even when confidence is low (so the user can judge it). */
  candidate?: Candidate
  confidence: Confidence
  score: number
}

const HIGH_CONFIDENCE = 0.8
const LOW_CONFIDENCE = 0.55

// Words in titles that describe the upload rather than the recording.
const NOISE =
  /\b(official (music )?video|official audio|official visuali[sz]er|lyric video|lyrics?|audio|visuali[sz]er|hd|4k|mv)\b/g

/**
 * Lowercases and strips everything that commonly differs between services for the *same* recording:
 * accents, "feat." credits, remaster notes, YouTube upload labels and punctuation.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // accents (split off by NFKD above)
    .toLowerCase()
    .replace(/[([](feat|ft|with)\.? [^)\]]*[)\]]/g, '') // (feat. X)
    .replace(/\s(feat|ft)\.? .*$/, '') // trailing "feat. X"
    .replace(/[([][^)\]]*remaster[^)\]]*[)\]]/g, '') // (2011 Remaster)
    .replace(/\s-\s.*remaster.*$/, '') // - Remastered 2011
    .replace(NOISE, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Sørensen–Dice similarity over character bigrams: 1 = identical, 0 = nothing in common. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigrams = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.slice(i, i + 2)
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1)
  }
  let overlap = 0
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.slice(i, i + 2)
    const count = bigrams.get(bigram) ?? 0
    if (count > 0) {
      bigrams.set(bigram, count - 1)
      overlap++
    }
  }
  return (2 * overlap) / (a.length + b.length - 2)
}

function artistScore(source: string[], candidate: string[]): number {
  const a = normalize(source.join(' '))
  const b = normalize(candidate.join(' '))
  if (!a || !b) return 0
  // "Simon & Garfunkel" vs ["Simon", "Garfunkel"], or a lead artist vs a list: containment is a match.
  if (a.includes(b) || b.includes(a)) return 1
  return similarity(a, b)
}

function durationScore(a?: number, b?: number): number | undefined {
  if (a === undefined || b === undefined) return undefined
  const diffSeconds = Math.abs(a - b) / 1000
  if (diffSeconds <= 3) return 1
  if (diffSeconds <= 10) return 0.5
  return 0
}

/** Scores how likely `candidate` is the same recording as `source`, from 0 to 1. */
export function scoreCandidate(source: Track, candidate: Track): number {
  const title = similarity(normalize(source.title), normalize(candidate.title))
  const artist = artistScore(source.artists, candidate.artists)
  const duration = durationScore(source.durationMs, candidate.durationMs)
  return duration === undefined
    ? title * 0.65 + artist * 0.35
    : title * 0.6 + artist * 0.3 + duration * 0.1
}

/** Picks the best candidate for `source` and labels how confident we are in it. */
export function pickBestMatch(source: Track, candidates: Candidate[]): MatchResult {
  if (source.isrc) {
    const sameRecording = candidates.find(
      (c) => c.isrc?.toUpperCase() === source.isrc?.toUpperCase(),
    )
    if (sameRecording) return { source, candidate: sameRecording, confidence: 'exact', score: 1 }
  }

  let best: MatchResult = { source, confidence: 'none', score: 0 }
  for (const candidate of candidates) {
    const score = scoreCandidate(source, candidate)
    if (score > best.score) best = { source, candidate, score, confidence: 'none' }
  }
  best.confidence =
    best.score >= HIGH_CONFIDENCE ? 'high' : best.score >= LOW_CONFIDENCE ? 'low' : 'none'
  return best
}
