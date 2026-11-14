/**
 * YouTube has no structured "artist" field, so we infer it:
 *  - Auto-generated YouTube Music uploads come from a channel named "<Artist> - Topic"
 *    and the video title is just the song title.
 *  - Most other music videos are titled "<Artist> - <Title> (Official Video)".
 *  - Otherwise, fall back to the channel name (minus "VEVO") as the artist.
 */
export function parseYouTubeTitle(
  videoTitle: string,
  channelTitle: string,
): { title: string; artists: string[] } {
  const topic = channelTitle.match(/^(.+?) - Topic$/)
  if (topic) return { title: videoTitle.trim(), artists: [topic[1].trim()] }

  const dashed = videoTitle.match(/^(.+?)\s+[-\u2013\u2014]\s+(.+)$/)
  if (dashed) return { title: dashed[2].trim(), artists: [dashed[1].trim()] }

  const channelArtist = channelTitle
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*Official$/i, '')
    .trim()
  return { title: videoTitle.trim(), artists: [channelArtist] }
}
