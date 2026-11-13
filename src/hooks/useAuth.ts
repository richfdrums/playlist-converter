import { useReducer } from 'react'
import { isLoggedIn, logout, startLogin } from '../lib/oauth'
import type { Destination } from '../services/types'

/** Sign-in status for one destination, plus actions to change it. */
export function useAuth(destination: Destination) {
  // Tokens live in localStorage, which React can't observe; bump this to re-render after changes.
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  return {
    loggedIn: isLoggedIn(destination.id),
    connect: () => startLogin(destination.oauth),
    disconnect: () => {
      logout(destination.id)
      rerender()
    },
  }
}
