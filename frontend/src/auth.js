// Cognito hosted-UI auth using the Authorization Code flow.
// All config values must match what you set in the Cognito App Client.

const COGNITO_DOMAIN = 'us-west-2bn3bqkpky.auth.us-west-2.amazoncognito.com'
const CLIENT_ID = '4s12pis7k2c35m6gemfdrpi4v5'
const REDIRECT_URI = window.location.origin + '/callback'
const SCOPES = 'openid email profile'

// ── Token storage ────────────────────────────────────────────

export function getIdToken() {
  return localStorage.getItem('id_token')
}

export function isLoggedIn() {
  const token = getIdToken()
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

function saveTokens({ id_token, access_token, refresh_token }) {
  localStorage.setItem('id_token', id_token)
  if (access_token) localStorage.setItem('access_token', access_token)
  if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
}

export function clearTokens() {
  localStorage.removeItem('id_token')
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// ── Login / logout ───────────────────────────────────────────

export function login() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  })
  window.location.href = `https://${COGNITO_DOMAIN}/login?${params}`
}

export function logout() {
  clearTokens()
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: window.location.origin,
  })
  window.location.href = `https://${COGNITO_DOMAIN}/logout?${params}`
}

// ── Authorization Code exchange ──────────────────────────────

export async function handleCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) throw new Error('No authorization code in URL')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
  })

  const res = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  const tokens = await res.json()
  saveTokens(tokens)
  return tokens
}

// ── Token refresh ────────────────────────────────────────────

export async function refreshTokens() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) throw new Error('No refresh token')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  })

  const res = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    clearTokens()
    throw new Error('Refresh failed — user must log in again')
  }

  const tokens = await res.json()
  saveTokens(tokens)
  return tokens
}
