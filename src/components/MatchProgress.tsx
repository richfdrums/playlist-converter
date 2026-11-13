export function MatchProgress({ completed, total }: { completed: number; total: number }) {
  return (
    <section className="card">
      <label htmlFor="match-progress">
        Matching tracks… {completed} / {total}
      </label>
      <progress id="match-progress" value={completed} max={total} />
    </section>
  )
}
