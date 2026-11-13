import { Navigate, useSearchParams } from 'react-router'
import { parseSourceUrl } from '../../shared/urls'

/**
 * Android's share sheet opens /share?title=…&text=…&url=… (see share_target in vite.config.ts).
 * Apps disagree about which field holds the link, so check them all, then hand off to the home page.
 */
export function Share() {
  const [params] = useSearchParams()
  const fields = ['url', 'text', 'title'].map((key) => params.get(key) ?? '')
  const shared = fields.find((value) => parseSourceUrl(value)) ?? fields.find(Boolean) ?? ''

  return <Navigate to={`/?url=${encodeURIComponent(shared)}`} replace />
}
