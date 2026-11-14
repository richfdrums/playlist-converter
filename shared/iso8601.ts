/** Converts an ISO 8601 duration such as "PT3M20S" or "PT1H2M3.5S" to milliseconds. */
export function parseIsoDuration(value: string | undefined): number | undefined {
  if (!value) return undefined
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/)
  if (!match) return undefined
  const [, days, hours, minutes, seconds] = match
  const totalSeconds =
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)
  return Math.round(totalSeconds * 1000)
}
