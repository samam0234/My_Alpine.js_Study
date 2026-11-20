export function validatePost(form) {
  const fields = {}
  const title = (form.title || '').trim()
  const body = (form.body || '').trim()
  if (title.length < 1 || title.length > 200) fields.title = ['1~200자로 입력하세요.']
  if (body.length < 1) fields.body = ['본문을 입력하세요.']
  return fields
}

export async function readJsonResult(response) {
  if (response.status === 204) return { ok: true, status: 204, data: null }
  const body = await response.json()
  if (!response.ok) return { ok: false, status: response.status, error: body.error }
  return { ok: true, status: response.status, data: body.data, meta: body.meta }
}

export const API_PREFIX = '/api'

export function postListPath(query) {
  const params = new URLSearchParams()
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10))
  params.set('page', String(page))
  params.set('limit', String(limit))
  params.set('sort', ['createdAt', '-createdAt', '-commentCount'].includes(query.sort) ? query.sort : '-createdAt')
  if (query.q) params.set('q', query.q)
  return API_PREFIX + '/posts?' + params.toString()
}

export function errorText(error) {
  if (!error) return '요청을 처리하지 못했습니다.'
  return error.message || error.code || '요청을 처리하지 못했습니다.'
}

export function excerpts(documentText, question) {
  const words = String(question || '').toLowerCase().split(/\s+/).filter((word) => word.length > 1)
  return String(documentText || '').split(/\n\n+/).map((text) => text.trim()).filter(Boolean).filter((text) => {
    const lower = text.toLowerCase()
    return words.some((word) => lower.includes(word))
  }).slice(0, 3)
}

export function answerFromExcerpts(chunks) {
  if (!chunks.length) return '찾을 수 없습니다'
  return chunks.map((text, index) => text + ' (발췌 ' + (index + 1) + ')').join('\n')
}

export function parseHash(hash) {
  const raw = (hash || '#/posts').replace(/^#/, '')
  const [pathPart, queryPart = ''] = raw.split('?')
  const path = pathPart.startsWith('/') ? pathPart : '/' + pathPart
  const query = Object.fromEntries(new URLSearchParams(queryPart))
  const detail = path.match(/^\/posts\/([^/]+)$/)
  if (path === '/posts' || path === '/') return { name: 'list', query }
  if (path === '/write') return { name: 'write', query }
  if (path === '/login') return { name: 'login', query }
  if (path === '/signup') return { name: 'signup', query }
  if (path === '/ask') return { name: 'ask', query }
  if (path === '/extras') return { name: 'extras', query }
  if (detail) return { name: 'detail', id: detail[1], query }
  return { name: 'notfound', path, query }
}
