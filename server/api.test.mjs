import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { createApp } from './server.mjs'

async function start() {
  const dir = await mkdtemp(join(tmpdir(), 'alpine-study-'))
  const app = createApp({ dataFile: join(dir, 'db.json'), corsOrigin: 'http://127.0.0.1:5999', aiLimit: 30 })
  const port = await app.listen(0)
  return {
    dir,
    app,
    base: 'http://127.0.0.1:' + port,
    async stop() {
      await app.close()
      await rm(dir, { recursive: true, force: true })
    }
  }
}

async function login(base, email = 'mina@example.com') {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  })
  const body = await response.json()
  assert.equal(response.status, 200)
  return body.data.accessToken
}

test('헬스, 목록, 인증, 작성, 삭제', async () => {
  const ctx = await start()
  try {
    const health = await fetch(ctx.base + '/health')
    assert.equal((await health.json()).status, 'ok')
    const list = await fetch(ctx.base + '/api/posts?q=첫&page=1&limit=10&sort=-createdAt')
    const listed = await list.json()
    assert.equal(list.status, 200)
    assert.equal(listed.data[0].title, '첫 글')
    assert.equal(listed.meta.q, '첫')
    const denied = await fetch(ctx.base + '/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(denied.status, 401)
    const token = await login(ctx.base)
    const created = await fetch(ctx.base + '/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ title: '새 글', body: '본문', tags: ['a'] })
    })
    const createdBody = await created.json()
    assert.equal(created.status, 201)
    assert.equal(created.headers.get('location'), '/api/posts/' + createdBody.data.id)
    const removed = await fetch(ctx.base + '/api/posts/' + createdBody.data.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    assert.equal(removed.status, 204)
    const text = await removed.text()
    assert.equal(text, '')
  } finally {
    await ctx.stop()
  }
})

test('남의 글 수정은 403이고 검증 실패는 fields', async () => {
  const ctx = await start()
  try {
    const signup = await fetch(ctx.base + '/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'other@example.com', nickname: 'other', password: 'password123' })
    })
    assert.equal(signup.status, 201)
    const token = await login(ctx.base, 'other@example.com')
    const patch = await fetch(ctx.base + '/api/posts/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ title: '가로채기' })
    })
    const body = await patch.json()
    assert.equal(patch.status, 403)
    assert.equal(body.error.code, 'FORBIDDEN')
    const bad = await fetch(ctx.base + '/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ title: '', body: '' })
    })
    const badBody = await bad.json()
    assert.equal(bad.status, 400)
    assert.ok(badBody.error.fields.title)
  } finally {
    await ctx.stop()
  }
})

test('AI 스트림은 발췌만 반환한다', async () => {
  const ctx = await start()
  try {
    const token = await login(ctx.base)
    const response = await fetch(ctx.base + '/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ messages: [{ role: 'user', content: '알파' }], excerpts: [{ n: 1, text: '알파 설명' }] })
    })
    assert.equal(response.status, 200)
    const text = await response.text()
    assert.match(text, /발췌 1/)
    assert.match(text, /\[DONE\]/)
  } finally {
    await ctx.stop()
  }
})

test('mcp search_posts는 id와 title만 반환한다', async () => {
  const ctx = await start()
  const file = join(ctx.dir, 'db.json')
  await ctx.app.close()
  const child = spawn(process.execPath, ['server/mcp.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATA_FILE: file }
  })
  const lines = createInterface({ input: child.stdout })
  const pending = []
  lines.on('line', (line) => {
    const wait = pending.shift()
    if (wait) wait(JSON.parse(line))
  })
  function ask(message) {
    const result = new Promise((resolve) => pending.push(resolve))
    child.stdin.write(JSON.stringify(message) + '\n')
    return result
  }
  try {
    const init = await ask({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
    assert.equal(init.result.serverInfo.name, 'board')
    const called = await ask({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search_posts', arguments: { q: '첫', limit: 10 } } })
    const rows = JSON.parse(called.result.content[0].text)
    assert.equal(rows[0].title, '첫 글')
    assert.equal(rows[0].body, undefined)
  } finally {
    child.kill()
    await rm(ctx.dir, { recursive: true, force: true })
  }
})
