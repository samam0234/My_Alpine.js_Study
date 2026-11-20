import assert from 'node:assert/strict'
import test from 'node:test'
import { answerFromExcerpts, excerpts, postListPath, readJsonResult, validatePost } from './pure.mjs'

test('빈 제목은 title 오류', () => {
  const fields = validatePost({ title: '   ', body: '본문' })
  assert.ok(fields.title)
})

test('201자 제목은 거절하고 200자는 통과', () => {
  assert.ok(validatePost({ title: '가'.repeat(201), body: '본문' }).title)
  assert.equal(validatePost({ title: '가'.repeat(200), body: '본문' }).title, undefined)
})

test('204는 JSON을 읽지 않는다', async () => {
  let called = false
  const response = { status: 204, ok: true, json: async () => { called = true } }
  const result = await readJsonResult(response)
  assert.equal(result.status, 204)
  assert.equal(called, false)
})

test('400 fields를 그대로 전달', async () => {
  const response = {
    status: 400,
    ok: false,
    json: async () => ({ error: { code: 'VALIDATION_ERROR', message: '입력값을 확인하세요.', fields: { title: ['1~200자로 입력하세요.'] }, requestId: 't-1' } })
  }
  const result = await readJsonResult(response)
  assert.equal(result.error.fields.title[0], '1~200자로 입력하세요.')
})

test('목록 경로는 page와 limit 범위를 고친다', () => {
  const path = postListPath({ page: 0, limit: 80, q: '첫', sort: 'title' })
  const params = new URLSearchParams(path.split('?')[1])
  assert.equal(params.get('page'), '1')
  assert.equal(params.get('limit'), '50')
  assert.equal(params.get('sort'), '-createdAt')
  assert.equal(params.get('q'), '첫')
})

test('발췌가 없으면 찾지 못했다고 답한다', () => {
  assert.deepEqual(excerpts('첫 문단', '없는단어'), [])
  assert.equal(answerFromExcerpts([]), '찾을 수 없습니다')
  const chunks = excerpts('알파 설명\n\n베타만 있는 문단', '알파')
  assert.equal(chunks.length, 1)
  assert.match(answerFromExcerpts(chunks), /\(발췌 1\)/)
})
