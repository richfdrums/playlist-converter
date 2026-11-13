import type { SourcePlaylist } from '../../shared/types'
import { serviceLabel } from '../services/registry'

export function SourceSummary({ source }: { source: SourcePlaylist }) {
  return (
    <section className="card">
      <p className="eyebrow">From {serviceLabel(source.service)}</p>
      <h2>{source.name}</h2>
      <p className="hint">{source.tracks.length} tracks</p>
      {source.truncated && (
        <p className="warning">
          Only the first {source.tracks.length} tracks could be read from this playlist.
        </p>
      )}
    </section>
  )
}
