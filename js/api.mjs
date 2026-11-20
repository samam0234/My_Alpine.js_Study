export function apiBase() {
  return String(window.__CONFIG?.apiBase || '').replace(/\/$/, '')
}

export async function api(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) }
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body && !isForm) headers['Content-Type'] = 'application/json; charset=utf-8'
  const auth = window.Alpine?.store?.('auth')
  if (auth?.token) headers.Authorization = 'Bearer ' + auth.token
  if (auth?.csrf && options.method && options.method !== 'GET') headers['X-CSRF-Token'] = auth.csrf
  let response
  try {
    response = await fetch(apiBase() + path, {
      ...options,
      headers,
      credentials: 'include'
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    const wrapped = new Error('서버에 연결하지 못했습니다.')
    wrapped.status = 0
    throw wrapped
  }
  const csrf = response.headers.get('X-CSRF-Token')
  if (csrf && auth?.setCsrf) auth.setCsrf(csrf)
  if (response.status === 204) return { status: 204, data: null }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && auth?.clear && !path.endsWith('/login')) auth.clear()
    const error = new Error(body.error?.message || '요청을 처리하지 못했습니다.')
    error.status = response.status
    error.info = body.error || { code: 'INTERNAL', message: error.message, requestId: response.headers.get('X-Request-Id') }
    throw error
  }
  return { status: response.status, data: body.data, meta: body.meta }
}
