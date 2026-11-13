export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * fetch() + JSON parsing, with automatic retries when the API says we're going too fast (429).
 * Throws HttpError for any other non-2xx response, using the API's error message when it has one.
 */
export async function fetchJson<T>(url: string, init?: RequestInit, retries = 4): Promise<T> {
  const res = await fetch(url, init)

  if (res.status === 429 && retries > 0) {
    const retryAfterSeconds = Number(res.headers.get('Retry-After')) || 2
    await sleep(retryAfterSeconds * 1000)
    return fetchJson(url, init, retries - 1)
  }

  if (!res.ok) throw new HttpError(res.status, await errorMessage(res))
  if (res.status === 204) return undefined as T
  return res.json()
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    // Our Worker: { error: "…" }. Spotify/Google: { error: { message } }. Tidal: { errors: [{ detail }] }.
    if (typeof body.error === 'string') return body.error
    return body.error?.message ?? body.errors?.[0]?.detail ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

/**
 * Runs `worker` over `items` with at most `concurrency` calls in flight, preserving result order.
 * Keeps us polite to rate-limited APIs while still being much faster than one-at-a-time.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function lane() {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane))
  return results
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}
