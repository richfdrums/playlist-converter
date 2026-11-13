import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { Destination } from '../services/types'

interface Props {
  destination: Destination
  trackCount: number
  /** Called right before we navigate away to the sign-in page. */
  onBeforeConnect: () => void
  onFindMatches: () => void
}

/** Signs the user in to the destination if needed, then offers to start matching. */
export function ConnectPanel({ destination, trackCount, onBeforeConnect, onFindMatches }: Props) {
  const { loggedIn, connect, disconnect } = useAuth(destination)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect() {
    setError(null)
    onBeforeConnect()
    try {
      await connect()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!loggedIn) {
    return (
      <div className="actions">
        <button onClick={handleConnect}>Connect {destination.label}</button>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  const quota = destination.quotaCost?.(trackCount)

  return (
    <div className="actions">
      {quota !== undefined && (
        <p className="warning">
          {destination.label} allows about 10,000 API units per day for everyone using this app.
          This playlist needs roughly {quota.toLocaleString()} units
          {quota > 10_000 ? ', which is more than a full day’s allowance.' : '.'}
        </p>
      )}
      <button onClick={onFindMatches}>Find matches on {destination.label}</button>
      <p className="hint">
        Connected to {destination.label} ·{' '}
        <button className="link" onClick={disconnect}>
          Disconnect
        </button>
      </p>
    </div>
  )
}
