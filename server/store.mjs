import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 32)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const actual = scryptSync(password, Buffer.from(parts[1], 'hex'), 32)
  const expected = Buffer.from(parts[2], 'hex')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

function emptyDb() {
  const now = new Date().toISOString()
  return {
    seq: { user: 1, post: 2, comment: 1, upload: 0, mail: 0 },
    users: [
      { id: 1, email: 'mina@example.com', nickname: 'mina', passwordHash: hashPassword('password123') }
    ],
    sessions: [],
    posts: [
      { id: 1, title: '첫 글', body: '안녕하세요', tags: ['intro'], authorId: 1, createdAt: now, updatedAt: now },
      { id: 2, title: '둘째 글', body: 'Alpine 게시판', tags: [], authorId: 1, createdAt: now, updatedAt: now }
    ],
    comments: [
      { id: 1, postId: 1, authorId: 1, body: '첫 댓글', createdAt: now }
    ],
    uploads: [],
    mails: [],
    aiUsage: []
  }
}

export function createStore(file) {
  let db = emptyDb()
  let chain = Promise.resolve()

  async function load() {
    try {
      db = JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      db = emptyDb()
      await persist()
    }
  }

  async function persist() {
    await mkdir(dirname(file), { recursive: true })
    const tmp = file + '.tmp'
    await writeFile(tmp, JSON.stringify(db), 'utf8')
    await rename(tmp, file)
  }

  function update(fn) {
    const run = chain.then(async () => {
      const result = await fn(db)
      await persist()
      return result
    })
    chain = run.then(() => undefined, () => undefined)
    return run
  }

  return {
    load,
    read(fn) {
      return fn(db)
    },
    update
  }
}

export function publicUser(user) {
  return { id: user.id, email: user.email, nickname: user.nickname }
}

export function publicPost(db, post) {
  const author = db.users.find((user) => user.id === post.authorId)
  const commentCount = db.comments.filter((comment) => comment.postId === post.id).length
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    tags: post.tags || [],
    author: author ? { id: author.id, nickname: author.nickname } : { id: post.authorId, nickname: '알 수 없음' },
    commentCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  }
}

export function publicComment(db, comment) {
  const author = db.users.find((user) => user.id === comment.authorId)
  return {
    id: comment.id,
    body: comment.body,
    author: author ? { id: author.id, nickname: author.nickname } : { id: comment.authorId, nickname: '알 수 없음' },
    createdAt: comment.createdAt
  }
}

export function newToken() {
  return randomBytes(32).toString('hex')
}
