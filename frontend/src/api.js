import { getIdToken, refreshTokens, isLoggedIn, login } from './auth'

// In dev, Vite proxies /api → localhost:5000.
// In production, VITE_API_URL is set to the EC2 public URL (e.g. http://1.2.3.4).
const BASE = import.meta.env.VITE_API_URL ?? ''

async function request(path, options = {}) {
  let token = getIdToken()

  // Attempt a silent refresh if token is missing/expired
  if (!token || !isLoggedIn()) {
    try {
      await refreshTokens()
      token = getIdToken()
    } catch {
      login()
      return
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (res.status === 401) {
    clearTokens()
    login()
    return
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Items ────────────────────────────────────────────────────

export function getItems(filters = {}) {
  const params = new URLSearchParams()
  if (filters.item_type) params.set('item_type', filters.item_type)
  if (filters.category) params.set('category', filters.category)
  if (filters.status) params.set('status', filters.status)
  const qs = params.toString() ? `?${params}` : ''
  return request(`/api/items${qs}`)
}

export function getItem(id) {
  return request(`/api/items/${id}`)
}

export function createItem(data) {
  return request('/api/items', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function claimItem(id) {
  return request(`/api/items/${id}/claim`, { method: 'PUT' })
}

// ── Upload ───────────────────────────────────────────────────

export function getUploadUrl(filename) {
  return request(`/api/upload-url?filename=${encodeURIComponent(filename)}`)
}

export async function uploadImage(file) {
  const { upload_url, image_url } = await getUploadUrl(file.name)
  const res = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: file,
  })
  if (!res.ok) throw new Error('Image upload to S3 failed')
  return image_url
}

// ── User ─────────────────────────────────────────────────────

export function getMe() {
  return request('/api/me')
}
