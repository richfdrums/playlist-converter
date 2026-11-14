import { useState } from 'react'
import type { Track } from '../../shared/types'
import type { Confidence, MatchResult } from '../lib/matching'

interface Props {
  matches: MatchResult[]
  selected: boolean[]
  defaultName: string
  destinationLabel: string
  busy: boolean
  onToggle: (index: number) => void
  onCreate: (name: string) => void
}

const BADGE: Record<Confidence, string> = {
  exact: 'Exact',
  high: 'Likely',
  low: 'Unsure',
  none: 'Not found',
}

const describe = (track: Track) => `${track.title} — ${track.artists.join(', ')}`

export function MatchReview(props: Props) {
  const { matches, selected, defaultName, destinationLabel, busy, onToggle, onCreate } = props
  const [name, setName] = useState(defaultName)
  const selectedCount = selected.filter(Boolean).length

  const counts = matches.reduce((acc, m) => ({ ...acc, [m.confidence]: acc[m.confidence] + 1 }), {
    exact: 0,
    high: 0,
    low: 0,
    none: 0,
  } as Record<Confidence, number>)

  return (
    <section className="card">
      <h2>Review matches</h2>
      <p className="hint">
        {counts.exact} exact · {counts.high} likely · {counts.low} unsure · {counts.none} not found.
        Unsure matches are unticked — tick any that look right.
      </p>

      <ol className="matches">
        {matches.map((match, index) => (
          <li key={index} className={`match ${match.confidence}`}>
            <label>
              <input
                type="checkbox"
                checked={selected[index]}
                disabled={!match.candidate || busy}
                onChange={() => onToggle(index)}
              />
              <span className="match-text">
                <span className="source-track">{describe(match.source)}</span>
                {match.candidate ? (
                  <a href={match.candidate.url} target="_blank" rel="noreferrer">
                    → {describe(match.candidate)}
                  </a>
                ) : (
                  <span className="hint">No match on {destinationLabel}</span>
                )}
              </span>
              <span className={`badge ${match.confidence}`}>{BADGE[match.confidence]}</span>
            </label>
          </li>
        ))}
      </ol>

      <form
        className="create"
        onSubmit={(e) => {
          e.preventDefault()
          onCreate(name.trim() || defaultName)
        }}
      >
        <label htmlFor="playlist-name">New playlist name</label>
        <input
          id="playlist-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <button type="submit" disabled={busy || selectedCount === 0}>
          {busy ? 'Creating…' : `Create ${destinationLabel} playlist (${selectedCount} tracks)`}
        </button>
      </form>
    </section>
  )
}
