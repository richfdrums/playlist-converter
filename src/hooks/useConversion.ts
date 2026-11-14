import { useCallback, useReducer } from 'react'
import type { SourcePlaylist } from '../../shared/types'
import type { SourceRef } from '../../shared/urls'
import type { MatchResult } from '../lib/matching'
import { getAccessToken } from '../lib/oauth'
import { fetchSourcePlaylist, findMatches } from '../services/registry'
import type { Destination } from '../services/types'

// The conversion is a small state machine. Each phase carries exactly the data it needs,
// so components can't, say, render a review screen without matches (TypeScript enforces it).
export type ConversionState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'loaded'; source: SourcePlaylist }
  | { phase: 'matching'; source: SourcePlaylist; completed: number }
  | { phase: 'review'; source: SourcePlaylist; matches: MatchResult[]; selected: boolean[] }
  | { phase: 'creating'; source: SourcePlaylist; matches: MatchResult[]; selected: boolean[] }
  | { phase: 'done'; source: SourcePlaylist; playlistUrl: string; added: number }
  | { phase: 'error'; message: string; source?: SourcePlaylist }

type Action =
  | { type: 'load' }
  | { type: 'loaded'; source: SourcePlaylist }
  | { type: 'matchStart' }
  | { type: 'matchProgress'; completed: number }
  | { type: 'matched'; matches: MatchResult[] }
  | { type: 'toggle'; index: number }
  | { type: 'createStart' }
  | { type: 'created'; playlistUrl: string; added: number }
  | { type: 'failed'; message: string }
  | { type: 'reset' }

function reducer(state: ConversionState, action: Action): ConversionState {
  const source = 'source' in state ? state.source : undefined
  switch (action.type) {
    case 'load':
      return { phase: 'loading' }
    case 'loaded':
      return { phase: 'loaded', source: action.source }
    case 'matchStart':
      return source ? { phase: 'matching', source, completed: 0 } : state
    case 'matchProgress':
      return state.phase === 'matching' ? { ...state, completed: action.completed } : state
    case 'matched':
      if (!source) return state
      return {
        phase: 'review',
        source,
        matches: action.matches,
        // Pre-select confident matches; uncertain ones are left for the user to opt in.
        selected: action.matches.map((m) => m.confidence === 'exact' || m.confidence === 'high'),
      }
    case 'toggle':
      if (state.phase !== 'review') return state
      return { ...state, selected: state.selected.map((on, i) => (i === action.index ? !on : on)) }
    case 'createStart':
      return state.phase === 'review' ? { ...state, phase: 'creating' } : state
    case 'created':
      return source
        ? { phase: 'done', source, playlistUrl: action.playlistUrl, added: action.added }
        : state
    case 'failed':
      return { phase: 'error', message: action.message, source }
    case 'reset':
      return { phase: 'idle' }
  }
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function useConversion() {
  const [state, dispatch] = useReducer(reducer, { phase: 'idle' })

  const load = useCallback(async (ref: SourceRef) => {
    dispatch({ type: 'load' })
    try {
      dispatch({ type: 'loaded', source: await fetchSourcePlaylist(ref) })
    } catch (err) {
      dispatch({ type: 'failed', message: messageOf(err) })
    }
  }, [])

  const match = useCallback(async (destination: Destination, source: SourcePlaylist) => {
    dispatch({ type: 'matchStart' })
    try {
      const token = await getAccessToken(destination.oauth)
      if (!token)
        throw new Error(`Your ${destination.label} sign-in expired. Please connect again.`)
      const matches = await findMatches(destination, source.tracks, token, (completed) =>
        dispatch({ type: 'matchProgress', completed }),
      )
      dispatch({ type: 'matched', matches })
    } catch (err) {
      dispatch({ type: 'failed', message: messageOf(err) })
    }
  }, [])

  const create = useCallback(
    async (destination: Destination, name: string, description: string, trackIds: string[]) => {
      dispatch({ type: 'createStart' })
      try {
        const token = await getAccessToken(destination.oauth)
        if (!token)
          throw new Error(`Your ${destination.label} sign-in expired. Please connect again.`)
        const playlistUrl = await destination.createPlaylist(token, name, description, trackIds)
        dispatch({ type: 'created', playlistUrl, added: trackIds.length })
      } catch (err) {
        dispatch({ type: 'failed', message: messageOf(err) })
      }
    },
    [],
  )

  const toggle = useCallback((index: number) => dispatch({ type: 'toggle', index }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])
  /** Returns to the loaded playlist (e.g. after an error) without re-fetching it. */
  const backToSource = useCallback(
    (source: SourcePlaylist) => dispatch({ type: 'loaded', source }),
    [],
  )

  return { state, load, match, create, toggle, reset, backToSource }
}
