import type { FormEvent } from 'react'
import { parseSourceUrl, type SourceRef } from '../../shared/urls'
import { serviceLabel } from '../services/registry'

interface Props {
  url: string
  onUrlChange: (url: string) => void
  onSubmit: (ref: SourceRef) => void
  disabled: boolean
}

export function UrlForm({ url, onUrlChange, onSubmit, disabled }: Props) {
  // Derived on every render from the current input; no need to keep it in state.
  const ref = parseSourceUrl(url)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (ref) onSubmit(ref)
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <label htmlFor="playlist-url">Playlist link</label>
      <div className="row">
        <input
          id="playlist-url"
          type="url"
          inputMode="url"
          placeholder="https://tidal.com/playlist/…"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={disabled}
        />
        <button type="submit" disabled={!ref || disabled}>
          Load
        </button>
      </div>
      <p className="hint">
        {ref
          ? `${serviceLabel(ref.service)} playlist detected`
          : url
            ? 'Paste a public TIDAL, Spotify or YouTube Music playlist link.'
            : 'Supports TIDAL, Spotify and YouTube Music links.'}
      </p>
    </form>
  )
}
