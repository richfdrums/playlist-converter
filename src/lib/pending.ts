import type { ServiceId } from '../../shared/types'

// Signing in navigates away from the app, which throws away React state.
// We stash what the user was doing so the home page can pick up where they left off.
interface PendingConversion {
  url: string
  destination: ServiceId
}

const KEY = 'pending-conversion'

export function savePendingConversion(pending: PendingConversion): void {
  localStorage.setItem(KEY, JSON.stringify(pending))
}

export function peekPendingConversion(): PendingConversion | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PendingConversion) : null
  } catch {
    return null
  }
}

export function clearPendingConversion(): void {
  localStorage.removeItem(KEY)
}
