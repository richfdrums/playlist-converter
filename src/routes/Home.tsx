import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { ServiceId } from '../../shared/types'
import { parseSourceUrl } from '../../shared/urls'
import { ConnectPanel } from '../components/ConnectPanel'
import { DestinationPicker } from '../components/DestinationPicker'
import { MatchProgress } from '../components/MatchProgress'
import { MatchReview } from '../components/MatchReview'
import { ResultCard } from '../components/ResultCard'
import { SourceSummary } from '../components/SourceSummary'
import { UrlForm } from '../components/UrlForm'
import { useConversion } from '../hooks/useConversion'
import {
  clearPendingConversion,
  peekPendingConversion,
  savePendingConversion,
} from '../lib/pending'
import { destinations, serviceLabel } from '../services/registry'

const DESTINATION_KEY = 'preferred-destination'

function preferredDestination(): ServiceId {
  const saved = localStorage.getItem(DESTINATION_KEY)
  return saved && saved in destinations ? (saved as ServiceId) : 'spotify'
}

export function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { state, load, match, create, toggle, reset, backToSource } = useConversion()

  // Where we're starting from: a conversion interrupted by a sign-in page, a link shared to the
  // app (/?url=…), or nothing. Computed once, on the first render, so no effect has to set it.
  const [initial] = useState(() => {
    const pending = peekPendingConversion()
    return {
      url: pending?.url ?? searchParams.get('url') ?? '',
      destination: pending?.destination ?? preferredDestination(),
    }
  })
  const [url, setUrl] = useState(initial.url)
  const [chosenDestination, setChosenDestination] = useState<ServiceId>(initial.destination)

  // Side effects of resuming: tidy up and start loading the playlist.
  // React's StrictMode runs effects twice in development; the ref makes this run once.
  const resumed = useRef(false)
  useEffect(() => {
    if (resumed.current) return
    resumed.current = true
    clearPendingConversion()
    if (searchParams.has('url')) setSearchParams({}, { replace: true })
    const ref = parseSourceUrl(initial.url)
    if (ref) load(ref)
  }, [initial, searchParams, setSearchParams, load])

  const source = 'source' in state ? state.source : undefined
  // You can't convert a playlist to the service it came from, so fall back to another one.
  const destinationId =
    chosenDestination === source?.service
      ? (Object.keys(destinations).find((id) => id !== source.service) as ServiceId)
      : chosenDestination
  const destination = destinations[destinationId]

  function chooseDestination(id: ServiceId) {
    setChosenDestination(id)
    localStorage.setItem(DESTINATION_KEY, id)
  }

  const busy = state.phase === 'loading' || state.phase === 'matching' || state.phase === 'creating'

  return (
    <>
      <UrlForm url={url} onUrlChange={setUrl} onSubmit={load} disabled={busy} />

      {state.phase === 'loading' && <p className="hint center">Loading playlist…</p>}

      {source && <SourceSummary source={source} />}

      {state.phase === 'loaded' && (
        <section className="card">
          <DestinationPicker
            value={destinationId}
            exclude={state.source.service}
            onChange={chooseDestination}
          />
          <ConnectPanel
            // A new key gives each destination a fresh panel (and fresh sign-in state).
            key={destinationId}
            destination={destination}
            trackCount={state.source.tracks.length}
            onBeforeConnect={() => savePendingConversion({ url, destination: destinationId })}
            onFindMatches={() => match(destination, state.source)}
          />
        </section>
      )}

      {state.phase === 'matching' && (
        <MatchProgress completed={state.completed} total={state.source.tracks.length} />
      )}

      {(state.phase === 'review' || state.phase === 'creating') && (
        <MatchReview
          matches={state.matches}
          selected={state.selected}
          defaultName={state.source.name}
          destinationLabel={destination.label}
          busy={state.phase === 'creating'}
          onToggle={toggle}
          onCreate={(name) =>
            create(
              destination,
              name,
              `Converted from the ${serviceLabel(state.source.service)} playlist “${state.source.name}”.`,
              state.matches.flatMap((m, i) =>
                state.selected[i] && m.candidate ? [m.candidate.id] : [],
              ),
            )
          }
        />
      )}

      {state.phase === 'done' && (
        <ResultCard
          playlistUrl={state.playlistUrl}
          added={state.added}
          destinationLabel={destination.label}
          onReset={() => {
            setUrl('')
            reset()
          }}
        />
      )}

      {state.phase === 'error' && (
        <section className="card">
          <p className="error">{state.message}</p>
          <div className="actions">
            {state.source && <button onClick={() => backToSource(state.source!)}>Try again</button>}
            <button className="secondary" onClick={reset}>
              Start over
            </button>
          </div>
        </section>
      )}
    </>
  )
}
