import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { answerFromExcerpts, excerpts } from '../js/pure.mjs'
import { createStore, hashPassword, newToken, publicComment, publicPost, publicUser, verifyPassword } from './store.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
}

const blocked = new Set(['.env', '.git', 'data', 'node_modules', 'server'])

function requestIdOf(req) {
  return req.headers['x-request-id'] || randomUUID()
}

function send(res, status, body, requestId, extra = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Request-Id': requestId,
    'Cache-Control': 'no-store',
    ...extra
  }
  res.writeHead(status, headers)
  res.end(body)
}

function sendJson(res, status, payload, requestId, extra) {
  send(res, status, JSON.stringify(payload), requestId, extra)
}

function sendError(res, status, code, message, requestId, fields) {
  const error = { code, message, requestId }
  if (fields) error.fields = fields
  sendJson(res, status, { error }, requestId)
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(Object.assign(new Error('too large'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readJson(req) {
  const raw = await readBody(req)
  if (!raw.length) return {}
  try {
    return JSON.parse(raw.toString('utf8'))
  } catch {
    throw Object.assign(new Error('bad json'), { status: 400, code: 'BAD_REQUEST' })
  }
}

function cookieToken(req) {
  const header = req.headers.cookie || ''
  const found = header.split(';').map((part) => part.trim()).find((part) => part.startsWith('session='))
  return found ? decodeURIComponent(found.slice('session='.length)) : ''
}

function sessionUser(db, req) {
  const now = Date.now()
  const header = req.headers.authorization || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const token = bearer || cookieToken(req)
  const session = db.sessions.find((item) => item.token === token && item.expiresAt > now)
  if (!session) return null
  const user = db.users.find((item) => item.id === session.userId)
  if (!user) return null
  return { user, session, viaCookie: !bearer && token === session.token }
}

function cookieHeader(token) {
  return `session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`
}

function listPosts(db, query) {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10))
  const q = String(query.q || '').trim().toLowerCase()
  const sort = ['createdAt', '-createdAt', '-commentCount'].includes(query.sort) ? query.sort : '-createdAt'
  let rows = db.posts.map((post) => publicPost(db, post))
  if (q) rows = rows.filter((post) => post.title.toLowerCase().includes(q) || post.body.toLowerCase().includes(q))
  rows.sort((a, b) => {
    if (sort === 'createdAt') return a.createdAt.localeCompare(b.createdAt)
    if (sort === '-commentCount') return b.commentCount - a.commentCount || b.createdAt.localeCompare(a.createdAt)
    return b.createdAt.localeCompare(a.createdAt)
  })
  const total = rows.length
  const start = (page - 1) * limit
  return {
    data: rows.slice(start, start + limit),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), q: query.q || '' }
  }
}

function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
  if (!match) return null
  const boundary = '--' + (match[1] || match[2]).trim()
  const text = buffer.toString('binary')
  const parts = text.split(boundary).slice(1, -1)
  for (const part of parts) {
    const cleaned = part.replace(/^\r\n/, '').replace(/\r\n$/, '')
    const splitAt = cleaned.indexOf('\r\n\r\n')
    if (splitAt < 0) continue
    const head = cleaned.slice(0, splitAt)
    if (!/name="file"/i.test(head)) continue
    const filename = /filename="([^"]*)"/i.exec(head)?.[1] || 'upload.txt'
    const data = Buffer.from(cleaned.slice(splitAt + 4), 'binary')
    return { filename, data }
  }
  return null
}

function wsAccept(key) {
  return createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
}

function wsSend(socket, text) {
  const payload = Buffer.from(text)
  let header
  if (payload.length < 126) header = Buffer.from([0x81, payload.length])
  else header = Buffer.from([0x81, 126, payload.length >> 8, payload.length & 255])
  socket.write(Buffer.concat([header, payload]))
}

function attachWs(socket) {
  let buffer = Buffer.alloc(0)
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 2) {
      const length = buffer[1] & 127
      let offset = 2
      let size = length
      if (length === 126) {
        if (buffer.length < 4) return
        size = buffer.readUInt16BE(2)
        offset = 4
      } else if (length === 127) {
        socket.end()
        return
      }
      const mask = (buffer[1] & 128) !== 0
      const maskOffset = offset
      if (mask) offset += 4
      if (buffer.length < offset + size) return
      const opcode = buffer[0] & 15
      if (opcode === 8) socket.end()
      buffer = buffer.subarray(mask ? maskOffset + 4 + size : offset + size)
    }
  })
}

export function createApp(options = {}) {
  const file = options.dataFile || fileURLToPath(new URL('../data/db.json', import.meta.url))
  const store = createStore(file)
  const sockets = new Set()
  const corsOrigin = options.corsOrigin || process.env.CORS_ORIGIN || 'http://127.0.0.1:5500'
  const aiLimit = Number(options.aiLimit || process.env.AI_DAILY_TOKEN_LIMIT || 200000)

  function broadcast(payload) {
    const text = JSON.stringify(payload)
    for (const socket of sockets) {
      try { wsSend(socket, text) } catch { sockets.delete(socket) }
    }
  }

  const server = createServer(async (req, res) => {
    const requestId = requestIdOf(req)
    const origin = req.headers.origin
    if (origin) {
      if (origin !== corsOrigin && origin !== `http://127.0.0.1:${server.address()?.port}`) {
        sendError(res, 403, 'FORBIDDEN', '허용되지 않은 출처입니다.', requestId)
        return
      }
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Request-Id')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
      res.setHeader('Vary', 'Origin')
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'X-Request-Id': requestId })
      res.end()
      return
    }
    try {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname === '/health' && req.method === 'GET') {
        sendJson(res, 200, { status: 'ok' }, requestId)
        return
      }
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url, requestId)
        return
      }
      await serveStatic(req, res, url.pathname, requestId)
    } catch (error) {
      if (error.status === 413) {
        sendError(res, 413, 'PAYLOAD_TOO_LARGE', '업로드 한도를 넘었습니다.', requestId)
        return
      }
      if (error.status === 400) {
        sendError(res, 400, error.code || 'BAD_REQUEST', '요청 형식을 확인하세요.', requestId)
        return
      }
      console.error(requestId, error.message)
      sendError(res, 500, 'INTERNAL', '요청을 처리하지 못했습니다.', requestId)
    }
  })

  async function handleApi(req, res, url, requestId) {
    const path = url.pathname
    if (path === '/api/auth/signup' && req.method === 'POST') {
      const body = await readJson(req)
      const email = String(body.email || '').trim().toLowerCase()
      const nickname = String(body.nickname || '').trim()
      const password = String(body.password || '')
      const fields = {}
      if (!email.includes('@')) fields.email = ['이메일 형식을 확인하세요.']
      if (nickname.length < 1 || nickname.length > 30) fields.nickname = ['1~30자로 입력하세요.']
      if (password.length < 8) fields.password = ['8자 이상 입력하세요.']
      if (Object.keys(fields).length) {
        sendError(res, 400, 'VALIDATION_ERROR', '입력값을 확인하세요.', requestId, fields)
        return
      }
      const created = await store.update((db) => {
        if (db.users.some((user) => user.email === email)) return null
        db.seq.user += 1
        const user = { id: db.seq.user, email, nickname, passwordHash: hashPassword(password) }
        db.users.push(user)
        return publicUser(user)
      })
      if (!created) {
        sendError(res, 409, 'EMAIL_TAKEN', '이미 가입한 이메일입니다.', requestId)
        return
      }
      sendJson(res, 201, { data: created }, requestId)
      return
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      const body = await readJson(req)
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const found = store.read((db) => db.users.find((user) => user.email === email))
      if (!found || !verifyPassword(password, found.passwordHash)) {
        sendError(res, 401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호를 확인하세요.', requestId)
        return
      }
      const token = newToken()
      const csrf = newToken()
      const expiresAt = Date.now() + 60 * 60 * 1000
      await store.update((db) => {
        db.sessions.push({ token, csrf, userId: found.id, expiresAt })
      })
      sendJson(res, 200, { data: { user: publicUser(found), accessToken: token } }, requestId, {
        'Set-Cookie': cookieHeader(token),
        'X-CSRF-Token': csrf
      })
      return
    }

    if (path === '/api/auth/logout' && req.method === 'POST') {
      const auth = store.read((db) => sessionUser(db, req))
      if (!auth) {
        sendError(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.', requestId)
        return
      }
      if (!guardCsrf(auth, req, res, requestId)) return
      await store.update((db) => {
        db.sessions = db.sessions.filter((session) => session.token !== auth.session.token)
      })
      send(res, 204, '', requestId, { 'Set-Cookie': 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' })
      return
    }

    if (path === '/api/auth/me' && req.method === 'GET') {
      const auth = store.read((db) => sessionUser(db, req))
      if (!auth) {
        sendError(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.', requestId)
        return
      }
      sendJson(res, 200, { data: publicUser(auth.user) }, requestId, { 'X-CSRF-Token': auth.session.csrf })
      return
    }

    if (path === '/api/auth/oauth/github' && req.method === 'GET') {
      const token = newToken()
      const csrf = newToken()
      const expiresAt = Date.now() + 60 * 60 * 1000
      await store.update((db) => {
        let user = db.users.find((item) => item.email === 'github-demo@example.com')
        if (!user) {
          db.seq.user += 1
          user = { id: db.seq.user, email: 'github-demo@example.com', nickname: 'github-demo', passwordHash: hashPassword(newToken()) }
          db.users.push(user)
        }
        db.sessions.push({ token, csrf, userId: user.id, expiresAt })
      })
      res.writeHead(302, {
        Location: '/final.html#/extras',
        'Set-Cookie': cookieHeader(token),
        'X-Request-Id': requestId
      })
      res.end()
      return
    }

    if (path === '/api/posts' && req.method === 'GET') {
      const result = store.read((db) => listPosts(db, Object.fromEntries(url.searchParams)))
      sendJson(res, 200, result, requestId)
      return
    }

    const detail = path.match(/^\/api\/posts\/(\d+)$/)
    if (detail && req.method === 'GET') {
      const id = Number(detail[1])
      const post = store.read((db) => {
        const found = db.posts.find((item) => item.id === id)
        return found ? publicPost(db, found) : null
      })
      if (!post) {
        sendError(res, 404, 'NOT_FOUND', '글을 찾을 수 없습니다.', requestId)
        return
      }
      sendJson(res, 200, { data: post }, requestId)
      return
    }

    if (path === '/api/posts' && req.method === 'POST') {
      const auth = store.read((db) => sessionUser(db, req))
      if (!auth) {
        sendError(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.', requestId)
        return
      }
      if (!guardCsrf(auth, req, res, requestId)) return
      const body = await readJson(req)
      const fields = validatePost(body)
      if (Object.keys(fields).length) {
        sendError(res, 400, 'VALIDATION_ERROR', '입력값을 확인하세요.', requestId, fields)
        return
      }
      const post = await store.update((db) => {
        db.seq.post += 1
        const now = new Date().toISOString()
        const created = {
          id: db.seq.post,
          title: String(body.title).trim(),
          body: String(body.body).trim(),
          tags: Array.isArray(body.tags) ? body.tags.map(String).slice(0, 10) : [],
          authorId: auth.user.id,
          createdAt: now,
          updatedAt: now
        }
        db.posts.push(created)
        return publicPost(db, created)
      })
      broadcast({ type: 'post.created', post: { id: post.id, title: post.title } })
      sendJson(res, 201, { data: post }, requestId, { Location: '/api/posts/' + post.id })
      return
    }

    if (detail && req.method === 'PATCH') {
      const auth = await mutateAuth(req, res, requestId)
      if (!auth) return
      const id = Number(detail[1])
      const body = await readJson(req)
      const result = await store.update((db) => {
        const post = db.posts.find((item) => item.id === id)
        if (!post) return { missing: true }
        if (post.authorId !== auth.user.id) return { forbidden: true }
        if (body.title !== undefined) {
          const title = String(body.title).trim()
          if (title.length < 1 || title.length > 200) return { fields: { title: ['1~200자로 입력하세요.'] } }
          post.title = title
        }
        if (body.body !== undefined) {
          const text = String(body.body).trim()
          if (!text) return { fields: { body: ['본문을 입력하세요.'] } }
          post.body = text
        }
        post.updatedAt = new Date().toISOString()
        return { post: publicPost(db, post) }
      })
      if (result.missing) {
        sendError(res, 404, 'NOT_FOUND', '글을 찾을 수 없습니다.', requestId)
        return
      }
      if (result.forbidden) {
        sendError(res, 403, 'FORBIDDEN', '작성자만 수정할 수 있습니다.', requestId)
        return
      }
      if (result.fields) {
        sendError(res, 400, 'VALIDATION_ERROR', '입력값을 확인하세요.', requestId, result.fields)
        return
      }
      sendJson(res, 200, { data: result.post }, requestId)
      return
    }

    if (detail && req.method === 'DELETE') {
      const auth = await mutateAuth(req, res, requestId)
      if (!auth) return
      const id = Number(detail[1])
      const result = await store.update((db) => {
        const post = db.posts.find((item) => item.id === id)
        if (!post) return { missing: true }
        if (post.authorId !== auth.user.id) return { forbidden: true }
        db.posts = db.posts.filter((item) => item.id !== id)
        db.comments = db.comments.filter((item) => item.postId !== id)
        return { ok: true }
      })
      if (result.missing) {
        sendError(res, 404, 'NOT_FOUND', '글을 찾을 수 없습니다.', requestId)
        return
      }
      if (result.forbidden) {
        sendError(res, 403, 'FORBIDDEN', '작성자만 삭제할 수 있습니다.', requestId)
        return
      }
      send(res, 204, '', requestId)
      return
    }

    const comments = path.match(/^\/api\/posts\/(\d+)\/comments$/)
    if (comments && req.method === 'GET') {
      const id = Number(comments[1])
      const result = store.read((db) => {
        if (!db.posts.some((post) => post.id === id)) return null
        return db.comments.filter((comment) => comment.postId === id).map((comment) => publicComment(db, comment))
      })
      if (!result) {
        sendError(res, 404, 'NOT_FOUND', '글을 찾을 수 없습니다.', requestId)
        return
      }
      sendJson(res, 200, { data: result }, requestId)
      return
    }

    if (comments && req.method === 'POST') {
      const auth = await mutateAuth(req, res, requestId)
      if (!auth) return
      const id = Number(comments[1])
      const body = await readJson(req)
      const text = String(body.body || '').trim()
      if (!text) {
        sendError(res, 400, 'VALIDATION_ERROR', '입력값을 확인하세요.', requestId, { body: ['댓글을 입력하세요.'] })
        return
      }
      const created = await store.update((db) => {
        if (!db.posts.some((post) => post.id === id)) return null
        db.seq.comment += 1
        const comment = { id: db.seq.comment, postId: id, authorId: auth.user.id, body: text, createdAt: new Date().toISOString() }
        db.comments.push(comment)
        return publicComment(db, comment)
      })
      if (!created) {
        sendError(res, 404, 'NOT_FOUND', '글을 찾을 수 없습니다.', requestId)
        return
      }
      sendJson(res, 201, { data: created }, requestId)
      return
    }

    const removeComment = path.match(/^\/api\/comments\/(\d+)$/)
    if (removeComment && req.method === 'DELETE') {
      const auth = await mutateAuth(req, res, requestId)
      if (!auth) return
      const id = Number(removeComment[1])
      const result = await store.update((db) => {
        const comment = db.comments.find((item) => item.id === id)
        if (!comment) return { missing: true }
        if (comment.authorId !== auth.user.id) return { forbidden: true }
        db.comments = db.comments.filter((item) => item.id !== id)
        return { ok: true }
      })
      if (result.missing) {
        sendError(res, 404, 'NOT_FOUND', '댓글을 찾을 수 없습니다.', requestId)
        return
      }
      if (result.forbidden) {
        sendError(res, 403, 'FORBIDDEN', '작성자만 삭제할 수 있습니다.', requestId)
        return
      }
      send(res, 204, '', requestId)
      return
    }

    if (path === '/api/uploads' && req.method === 'POST') {
      const auth = await mutateAuth(req, res, requestId)
      if (!auth) return
      const raw = await readBody(req)
      const file = parseMultipart(raw, req.headers['content-type'])
      if (!file) {
        sendError(res, 400, 'BAD_REQUEST', 'file 필드가 필요합니다.', requestId)
        return
      }
      const text = file.data.toString('utf8')
      if (file.data.length > 1024 * 1024) {
        sendError(res, 413, 'PAYLOAD_TOO_LARGE', '1MB 이하만 올립니다.', requestId)
        return
      }
      const saved = await store.update((db) => {
        db.seq.upload += 1
        const row = { id: db.seq.upload, filename: file.filename, text: text.slice(0, 8000), userId: auth.user.id }
        db.uploads.push(row)
        return { id: row.id, filename: row.filename }
      })
      sendJson(res, 201, { data: saved }, requestId)
      return
    }

    if (path === '/api/notifications/email' && req.method === 'POST') {
      const auth = await mutateAuth(req, res, requestId)
      if (!auth) return
      const body = await readJson(req)
      const subject = String(body.subject || '').trim()
      const text = String(body.text || '').trim()
      if (!subject || !text) {
        sendError(res, 400, 'VALIDATION_ERROR', '입력값을 확인하세요.', requestId, { subject: ['제목과 본문이 필요합니다.'] })
        return
      }
      const saved = await store.update((db) => {
        db.seq.mail += 1
        db.mails.push({ id: db.seq.mail, userId: auth.user.id, subject, text, createdAt: new Date().toISOString() })
        return { id: db.seq.mail }
      })
      sendJson(res, 202, { data: saved }, requestId)
      return
    }

    if (path === '/api/checkout' && req.method === 'POST') {
      const auth = await mutateAuth(req, res, requestId)
      if (!auth) return
      sendJson(res, 200, { data: { url: 'https://example.com/alpine-study-checkout' } }, requestId)
      return
    }

    if ((path === '/api/ai/chat' || path === '/api/ai/chat/stream') && req.method === 'POST') {
      const auth = await mutateAuth(req, res, requestId)
      if (!auth) return
      const body = await readJson(req)
      const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : []
      const question = String(messages.at(-1)?.content || '').slice(0, 2000)
      const source = Array.isArray(body.excerpts) ? body.excerpts.map((item) => String(item.text || '')).slice(0, 3) : excerpts('', question)
      const used = source.length ? source : excerpts(String(body.documentText || ''), question)
      if (question.toLowerCase().includes('거부테스트')) {
        sendJson(res, 200, { data: { text: '이 요청에는 답할 수 없습니다.', stopReason: 'refusal' } }, requestId)
        return
      }
      const answer = answerFromExcerpts(used)
      const tokens = question.length + answer.length
      const allowed = await store.update((db) => {
        const day = new Date().toISOString().slice(0, 10)
        let row = db.aiUsage.find((item) => item.userId === auth.user.id && item.day === day)
        if (!row) {
          row = { userId: auth.user.id, day, tokens: 0 }
          db.aiUsage.push(row)
        }
        if (row.tokens + tokens > aiLimit) return false
        row.tokens += tokens
        return true
      })
      if (!allowed) {
        sendError(res, 429, 'AI_QUOTA_EXCEEDED', '오늘 사용 한도에 도달했습니다.', requestId)
        return
      }
      if (path.endsWith('/stream')) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Request-Id': requestId
        })
        for (const piece of answer.match(/.{1,24}/gsu) || [answer]) {
          res.write(`data: ${JSON.stringify({ text: piece })}\n\n`)
        }
        res.write('data: [DONE]\n\n')
        res.end()
        return
      }
      sendJson(res, 200, { data: { text: answer, stopReason: 'end_turn' }, meta: { usage: { inputTokens: question.length, outputTokens: answer.length } } }, requestId)
      return
    }

    sendError(res, 404, 'NOT_FOUND', '없는 경로입니다.', requestId)
  }

  function guardCsrf(auth, req, res, requestId) {
    if (!auth.viaCookie) return true
    if (req.headers['x-csrf-token'] === auth.session.csrf) return true
    sendError(res, 403, 'FORBIDDEN', 'CSRF 토큰이 필요합니다.', requestId)
    return false
  }

  async function mutateAuth(req, res, requestId) {
    const auth = store.read((db) => sessionUser(db, req))
    if (!auth) {
      sendError(res, 401, 'UNAUTHORIZED', '로그인이 필요합니다.', requestId)
      return null
    }
    if (!guardCsrf(auth, req, res, requestId)) return null
    return auth
  }

  server.on('upgrade', (req, socket) => {
    if (req.url !== '/ws') {
      socket.destroy()
      return
    }
    const key = req.headers['sec-websocket-key']
    if (!key) {
      socket.destroy()
      return
    }
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + wsAccept(key) + '\r\n\r\n'
    )
    sockets.add(socket)
    attachWs(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => sockets.delete(socket))
  })

  return {
    server,
    store,
    async listen(port = 0) {
      await store.load()
      await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
      const address = server.address()
      return address.port
    },
    async close() {
      for (const socket of sockets) socket.destroy()
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    }
  }
}

function validatePost(body) {
  const fields = {}
  const title = String(body.title || '').trim()
  const text = String(body.body || '').trim()
  if (title.length < 1 || title.length > 200) fields.title = ['1~200자로 입력하세요.']
  if (text.length < 1) fields.body = ['본문을 입력하세요.']
  return fields
}

async function serveStatic(req, res, pathname, requestId) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendError(res, 404, 'NOT_FOUND', '없는 경로입니다.', requestId)
    return
  }
  const requested = pathname === '/' ? '/index.html' : pathname
  const parts = requested.split('/').filter(Boolean)
  if (parts.some((part) => part === '..' || part.startsWith('.'))) {
    sendError(res, 404, 'NOT_FOUND', '없는 경로입니다.', requestId)
    return
  }
  if (parts.some((part) => blocked.has(part))) {
    sendError(res, 404, 'NOT_FOUND', '없는 경로입니다.', requestId)
    return
  }
  const file = normalize(join(root, ...parts))
  if (!file.startsWith(normalize(root))) {
    sendError(res, 404, 'NOT_FOUND', '없는 경로입니다.', requestId)
    return
  }
  let info
  try {
    info = await stat(file)
  } catch {
    sendError(res, 404, 'NOT_FOUND', '없는 경로입니다.', requestId)
    return
  }
  if (!info.isFile()) {
    sendError(res, 404, 'NOT_FOUND', '없는 경로입니다.', requestId)
    return
  }
  res.writeHead(200, {
    'Content-Type': types[extname(file)] || 'application/octet-stream',
    'X-Request-Id': requestId,
    'Cache-Control': 'no-store'
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isMain) {
  const app = createApp()
  const port = Number(process.env.PORT || 5500)
  app.listen(port).then((bound) => {
    console.log('http://127.0.0.1:' + bound)
  })
}
