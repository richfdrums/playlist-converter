import type { Track } from '../../shared/types'

/**
 * Simplifies a track into search-box text: the title without bracketed extras or " - Remastered…"
 * suffixes, plus the lead artist. Search engines do better with less; scoring compares the full title.
 */
export function searchTerms(track: Track): { title: string; artist: string } {
  const title = track.title
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .replace(/\s+-\s+.*$/, '')
    .replace(/["':]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const artist = (track.artists[0] ?? '').replace(/["':]/g, ' ').trim()
  return { title: title || track.title, artist }
}
