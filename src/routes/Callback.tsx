import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { completeLogin } from '../lib/oauth'
import { oauthProviders } from '../services/registry'

/** The page each service redirects back to after sign-in (/callback?code=…&state=…). */
export function Callback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  // A sign-in code can only be exchanged once, and StrictMode runs effects twice in development.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    completeLogin(new URLSearchParams(window.location.search), oauthProviders)
      .then(() => navigate('/', { replace: true }))
      .catch((err: Error) => setError(err.message))
  }, [navigate])

  if (!error) return <p className="hint center">Finishing sign-in…</p>

  return (
    <section className="card">
      <p className="error">{error}</p>
      <Link className="button" to="/">
        Back to the converter
      </Link>
    </section>
  )
}
