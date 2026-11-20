# study9. 테스트·디버깅

## ① 목표

DOM에 기대지 않는 함수는 단위 테스트하고, `fetch`는 가짜로 바꾸며, Alpine 페이지의 오류를 콘솔·네트워크·Alpine 저장 데이터로 찾는다.

## ② 📖 이론

### 왜 쓰는지

브라우저를 손으로 눌러 보는 확인은 필요하다. 다만 `validatePost`의 200자 경계를 매번 손으로 치면 빠진다. Alpine 디렉티브 자체는 HTML 안에서 평가되므로, 테스트는 "화면 정책과 API 해석"처럼 순수 함수로 빼 둔 부분에 건다. 디렉티브가 보이는지는 개발자도구로 확인한다.

### 핵심 개념

- **단위 테스트**: Node.js 내장 `node:test`. 추가 테스트 프레임워크를 설치하지 않는다. `js/pure.js`를 `export` 없이 브라우저가 읽게 뒀다면, 테스트 파일은 같은 검사를 함수로 한 번 더 복사하지 말고 `pure.js` 끝에 브라우저 전용 분기를 두지 않는 편이 낫다. 학습 예제는 테스트가 같은 규칙을 직접 호출하도록 `js/pure.mjs`로 순수 함수만 분리한다.
- **요청 테스트**: `api()`가 호출하는 `fetch`를 테스트 동안 가짜 함수로 바꾼다. 진짜 API와 DB는 호출하지 않는다.
- **디버깅**:
  - Console: 표현식 오류, `Alpine is not defined`
  - Elements: `x-show`가 만든 `display`, `x-if`로 빠진 노드
  - Network: 상태 코드, `X-Request-Id`, 요청 JSON
  - Application: `localStorage`에 토큰이 없는가
  - Alpine 3 콘솔: 요소를 선택한 뒤 `$0.__x` 또는 이벤트 `alpine:init` 이후 `Alpine.store('auth')`
- **로그**: 브라우저 콘솔에 `requestId`와 상태 코드만 남긴다. 토큰, 비밀번호, 본문 전체를 남기지 않는다. 서버 로그는 `requestId`로 찾는다.

### 비유

가짜 `fetch`는 창구 연습용 도장이다. 창고(DB)를 열지 않고도 "201이면 창구가 영수증을 준다"만 확인한다.

## ③ 🛠️ 실기

`js/pure.mjs`

```javascript
export function validatePost(form) {
  const fields = {}
  const title = (form.title || '').trim()
  if (title.length < 1 || title.length > 200) fields.title = ['1~200자로 입력하세요.']
  return fields
}

export async function readJsonResult(response) {
  if (response.status === 204) return { ok: true, status: 204, data: null }
  const body = await response.json()
  if (!response.ok) return { ok: false, status: response.status, error: body.error }
  return { ok: true, status: response.status, data: body.data, meta: body.meta }
}
```

`js/pure.test.mjs`

```javascript
import assert from 'node:assert/strict'
import test from 'node:test'
import { validatePost, readJsonResult } from './pure.mjs'

test('빈 제목은 title 오류', () => {
  const fields = validatePost({ title: '   ' })
  assert.ok(fields.title)
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
```

실행:

```powershell
node --test js/pure.test.mjs
```

가짜 `fetch`로 목록 계약만 확인하는 테스트:

```javascript
test('목록 요청은 data 배열을 쓴다', async () => {
  const fetchMock = async (url) => {
    assert.match(String(url), /\/api\/posts\?/)
    return {
      ok: true,
      status: 200,
      headers: { get: () => 't-2' },
      json: async () => ({ data: [{ id: 1, title: '첫 글' }], meta: { page: 1, limit: 10, total: 1, totalPages: 1, q: '' } })
    }
  }
  const response = await fetchMock('http://127.0.0.1:8080/api/posts?page=1&limit=10')
  const body = await response.json()
  assert.equal(body.data[0].title, '첫 글')
})
```

이 가짜는 DB에 연결하지 않는다. 테스트 환경 변수로 `DATABASE_URL`을 읽지 않는다.

### 자주 나는 오류 TOP 10

| # | 증상 | 원인 | 해결 |
| --- | --- | --- | --- |
| 1 | 디렉티브가 글자로 남음 | CDN 404 또는 `defer` 누락 | Network에서 `cdn.min.js` 200, 버전 3.17.5 |
| 2 | `x-for` 오류 | `template`이 아님, `:key` 누락 | `<template x-for :key>` |
| 3 | `x-if`와 `x-for`가 같이 안 먹음 | 한 요소에 둘을 씀 | 템플릿을 중첩 |
| 4 | 클릭이 다른 컴포넌트를 안 바꿈 | 스코프가 끊김 | `$dispatch` 또는 스토어 |
| 5 | 목록이 객체라 반복 실패 | `{ data }`를 배열로 사용 | `.data` 할당 |
| 6 | 삭제 후 JSON 파싱 오류 | 204 본문 | 204는 `json()` 금지 |
| 7 | CORS 실패 | 원점 불일치 | 서버 `CORS_ORIGIN` |
| 8 | 새로고침 후 로그인 풀림 | 메모리 Bearer | 쿠키 + `/api/auth/me` 또는 재로그인 |
| 9 | 입력이 저장소에만 있고 화면과 다름 | `x-model` 누락 | `x-model`과 키 이름 일치 |
| 10 | 같은 이벤트가 두 번 | `init()`과 `x-init`이 둘 다 호출 | 시작은 한곳 |

### 줄별 설명

1. `validatePost`는 공백 제목을 실패로 본다.
2. `readJsonResult`는 `api()`와 같은 상태 해석을 DOM 없이 둔 함수다.
3. `204` 테스트는 `json`이 호출되면 `called`가 참이 되어 실패한다.
4. `400` 테스트는 스펙의 `fields.title[0]`이 유지되는지만 본다.
5. `node --test`는 파일 안의 `test()`를 실행한다.
6. 가짜 `fetch`는 URL에 `/api/posts?`가 있는지만 확인하고 고정 JSON을 돌려준다.

## ④ 🔗 연동 포인트

테스트 프로세스는 `API_BASE`가 있어도 그 주소로 소켓을 열지 않는다. `fetch` 가짜가 스펙의 `data`/`meta`/`error`만 돌려주므로 DB를 테스트 더블로 바꿀 자리가 Alpine 안에 없다. API를 가짜로 바꾸는 자리가 `fetch`다. 통합 확인이 필요하면 study6의 개발 서버를 사람이 Network 패널로 보고, 자동 테스트에는 넣지 않는다. `requestId`가 테스트 이름과 같게 고정되어 있으면 실패 로그를 테스트 케이스와 연결할 수 있다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `Cannot use import statement` | `pure.test.mjs`가 아닌 `.js`에서 `import` | 확장자를 `.mjs`로 두거나 패키지 타입을 명시한다 |
| 테스트가 진짜 8080에 접속 | 가짜로 바꾸기 전에 `fetch`를 호출 | 테스트 파일 안에서만 가짜를 넘긴다 |
| `node --test`가 0개 | 파일 경로가 루트가 아님 | 프로젝트 루트에서 `node --test js/pure.test.mjs` |
| 콘솔 로그에 토큰이 남음 | 실패 객체 전체를 출력 | `status`와 `error.code`, `requestId`만 출력한다 |
| `$0.__x`가 없음 | 선택한 노드가 Alpine 스코프 밖 | `x-data` 요소를 선택한다 |

## ⑥ 직접 해보기

1. 제목 200자는 통과하고 201자는 `title` 오류가 나게 테스트를 하나 추가한다.
2. `readJsonResult`에 `401` 응답을 넣어 `error.code`가 `UNAUTHORIZED`일 때 `ok === false`인지 본다.
3. 일부러 `template` 없이 `x-for`를 넣어 콘솔 메시지가 TOP 10의 2번과 같은지 확인한 뒤 되돌린다.

## ⑦ ☐ 체크리스트

- [ ] `node --test js/pure.test.mjs`가 통과한다
- [ ] 204 테스트가 `json()`을 호출하지 않는다
- [ ] 400 테스트가 `error.fields`를 유지한다
- [ ] 가짜 `fetch`가 실제 호스트로 나가지 않는다
- [ ] 테스트가 `DATABASE_URL`이나 비밀을 읽지 않는다
- [ ] Console, Network, Application, `$store`로 원인을 나눌 수 있다
- [ ] TOP 10 표의 해결을 해당 파일에 반영했다
- [ ] 로그에 토큰과 비밀번호가 없다

## ⑧ 다음 단계

study10에서 정적 파일을 빌드·배포하고, 운영의 `config.js`와 API 원점이 배포 뒤에도 이어지는지 점검표로 확인한다.
