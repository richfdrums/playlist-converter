import { HttpError, type Env } from '../env'

// Google's "Web application" OAuth clients require the client secret even with PKCE,
// so the browser sends the code (or refresh token) here and we add the secret.
interface TokenRequest {
  grant_type: 'authorization_code' | 'refresh_token'
  code?: string
  code_verifier?: string
  redirect_uri?: string
  refresh_token?: string
}

export async function exchangeGoogleToken(
  request: Request,
  env: Env,
  origin: string,
): Promise<unknown> {
  const body = (await request.json()) as TokenRequest
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
  })

  if (body.grant_type === 'authorization_code' && body.code && body.code_verifier) {
    // Only ever complete logins that were redirected back to this app.
    if (body.redirect_uri !== `${origin}/callback`) throw new HttpError(400, 'Bad redirect_uri')
    params.set('grant_type', 'authorization_code')
    params.set('code', body.code)
    params.set('code_verifier', body.code_verifier)
    params.set('redirect_uri', body.redirect_uri)
  } else if (body.grant_type === 'refresh_token' && body.refresh_token) {
    params.set('grant_type', 'refresh_token')
    params.set('refresh_token', body.refresh_token)
  } else {
    throw new HttpError(400, 'Invalid token request')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: params })
  if (!res.ok) throw new HttpError(res.status === 400 ? 400 : 502, 'Google sign-in failed')
  return res.json()
}
