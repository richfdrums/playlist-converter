interface Props {
  playlistUrl: string
  added: number
  destinationLabel: string
  onReset: () => void
}

export function ResultCard({ playlistUrl, added, destinationLabel, onReset }: Props) {
  return (
    <section className="card success">
      <h2>Done!</h2>
      <p>
        Added {added} tracks to a new private {destinationLabel} playlist.
      </p>
      <div className="actions">
        <a className="button" href={playlistUrl} target="_blank" rel="noreferrer">
          Open in {destinationLabel}
        </a>
        <button className="secondary" onClick={onReset}>
          Convert another
        </button>
      </div>
    </section>
  )
}
