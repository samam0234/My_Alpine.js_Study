# study6. DB·API 연동

## ① 목표

공통 API 스펙 v1의 게시글 CRUD를 Alpine `fetch`로 연결하고, 목록은 `x-init`에서 불러오며, 접속 주소는 공개 설정으로 분리한다.

## ② 📖 이론

### 왜 쓰는지

Alpine은 데이터베이스 드라이버가 없다. 브라우저에서 MariaDB나 PostgreSQL 포트로 직접 접속하면 비밀번호가 페이지에 실린다. 이 단계의 DB 연동은 "스펙을 지키는 HTTP API를 통해 목록·상세·등록·수정·삭제를 한다"는 뜻이다. API 뒤의 저장소가 파일이든 DB든 Alpine 코드는 `{ data, meta }`와 `{ error }`만 본다.

### 핵심 개념

- **연결 설정**: `.env`의 `API_BASE`를 Git에 올리지 않는 `js/config.js`로 옮긴다.

```javascript
window.__CONFIG = { apiBase: 'http://127.0.0.1:8080' }
```

  `config.js`는 `.gitignore`에 있다. 예제 HTML은 설명을 줄이기 위해 같은 값을 스크립트 상수로 두되, 실제 파일에서는 `window.__CONFIG.apiBase`만 읽는다.
- **모델**: 화면이 기대하는 글은 `id`, `title`, `body`, `tags`, `author`, `commentCount`, `createdAt`, `updatedAt`이다. 시각은 ISO 8601 UTC 문자열이다.
- **목록**: `GET /api/posts?q&page&limit&sort`. 응답은 `{ data: [...], meta: { page, limit, total, totalPages, q } }`.
- **상세**: `GET /api/posts/{id}` → `{ data }`.
- **등록**: `POST /api/posts` → `201`, 헤더 `Location`.
- **수정**: `PATCH /api/posts/{id}`만 사용한다. PUT으로 전체 교체하지 않는다.
- **삭제**: `DELETE /api/posts/{id}` → `204`, 본문 없음.
- **오류**: 4xx·5xx는 `{ error: { code, message, fields, requestId } }`. `500`의 `message`에 스택을 기대하지 않는다.
- **인증이 필요한 쓰기**: `Authorization: Bearer`는 study7에서 붙인다. 토큰이 없으면 쓰기는 `401`을 그대로 보여 준다.

노션의 최소 예는 아래다. 스펙의 목록이 `{ data }`이므로 `.data`를 넣는다.

```html
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>

<div x-data="{ posts: [], q: '' }"
     x-init="posts = (await (await fetch('/api/posts')).json()).data">
  <input x-model="q" placeholder="검색">
  <template x-for="p in posts.filter(p => p.title.includes(q))" :key="p.id">
    <p x-text="p.title"></p>
  </template>
</div>
```

학습 페이지에서는 CDN을 `3.17.5`로 고정하고, 검색의 기준 구현은 서버 쿼리 `q`로 둔다. 위 필터는 이미 받아 온 페이지 안에서의 추가 거름이다.

### 비유

API는 창구다. Alpine은 창구 번호(`API_BASE`)와 양식(`data`/`error`)만 알고, 창고 열쇠(DB 계정)는 창구 뒤에 있다.

## ③ 🛠️ 실기

`js/api.js`에 둘 클라이언트다. HTML 예제는 그 함수를 페이지 안에 풀어 적었다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Alpine CRUD</title>
  <script>
    window.__CONFIG = { apiBase: 'http://127.0.0.1:8080' }
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
  <script>
    const base = () => window.__CONFIG.apiBase.replace(/\/$/, '')

    async function api(path, options = {}) {
      const response = await fetch(base() + path, {
        ...options,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json; charset=utf-8',
          ...(options.headers || {})
        }
      })
      const requestId = response.headers.get('X-Request-Id')
      if (response.status === 204) return { status: 204, data: null, requestId }
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        const error = body.error || { code: 'INTERNAL', message: '요청을 처리하지 못했습니다.' }
        if (!error.requestId && requestId) error.requestId = requestId
        throw Object.assign(new Error(error.message), { status: response.status, error })
      }
      return { status: response.status, data: body.data, meta: body.meta, requestId }
    }

    document.addEventListener('alpine:init', () => {
      Alpine.data('board', () => ({
        posts: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 1, q: '' },
        q: '',
        form: { title: '', body: '' },
        editingId: null,
        message: '',
        async load() {
          try {
            const params = new URLSearchParams({ page: String(this.meta.page), limit: '10', sort: '-createdAt' })
            if (this.q.trim()) params.set('q', this.q.trim())
            const result = await api('/api/posts?' + params.toString())
            this.posts = result.data
            this.meta = result.meta
            this.message = ''
          } catch (error) {
            this.message = error.message
          }
        },
        async create() {
          try {
            await api('/api/posts', { method: 'POST', body: JSON.stringify({ title: this.form.title, body: this.form.body, tags: [] }) })
            this.form = { title: '', body: '' }
            await this.load()
          } catch (error) {
            this.message = error.error?.fields?.title?.[0] || error.message
          }
        },
        edit(post) {
          this.editingId = post.id
          this.form = { title: post.title, body: post.body }
        },
        async patch() {
          try {
            await api('/api/posts/' + this.editingId, { method: 'PATCH', body: JSON.stringify({ title: this.form.title }) })
            this.editingId = null
            await this.load()
          } catch (error) {
            this.message = error.message
          }
        },
        async remove(id) {
          try {
            await api('/api/posts/' + id, { method: 'DELETE' })
            await this.load()
          } catch (error) {
            this.message = error.message
          }
        }
      }))
    })
  </script>
</head>
<body>
  <div x-data="board" x-init="load()">
    <p x-show="message" x-text="message"></p>
    <input x-model="q" @change="meta.page = 1; load()" placeholder="검색">
    <template x-for="post in posts" :key="post.id">
      <article>
        <h2 x-text="post.title"></h2>
        <button type="button" @click="edit(post)">수정</button>
        <button type="button" @click="remove(post.id)">삭제</button>
      </article>
    </template>
    <p>page <span x-text="meta.page"></span> / <span x-text="meta.totalPages"></span>, total <span x-text="meta.total"></span></p>
    <form @submit.prevent="editingId ? patch() : create()">
      <input x-model.trim="form.title" placeholder="제목">
      <textarea x-model.trim="form.body" placeholder="본문"></textarea>
      <button type="submit" x-text="editingId ? '부분 수정' : '등록'"></button>
    </form>
  </div>
</body>
</html>
```

API가 아직 없으면 콘솔과 `message`에 네트워크 오류가 난다. 그것은 실패를 숨기지 않은 정상 동작이다. 스펙을 지키는 서버를 `API_BASE`에 둔 뒤 목록이 `data`로 채워지는지 Network 패널에서 확인한다.

### 줄별 설명

1. `window.__CONFIG.apiBase`는 비밀이 아닌 공개 원점이다.
2. `api()`는 경로 앞에 원점을 붙이고 JSON 헤더를 넣는다. `Content-Type`은 스펙의 `application/json; charset=utf-8`이다.
3. `204`는 본문이 없으므로 `json()`을 호출하지 않는다.
4. 실패 본문의 `error`가 없으면 `INTERNAL`로 감싼다. 헤더 `X-Request-Id`를 `requestId`가 비어 있을 때만 채운다.
5. 성공은 `data`와 `meta`를 그대로 돌려준다. 목록 래퍼를 벗기지 않은 채 컴포넌트에 넘기지 않는다.
6. `x-init="load()"`가 첫 목록 요청이다. 컴포넌트에 `init()`을 따로 두면 Alpine이 그 메서드도 호출해 요청이 두 번 나간다.
7. 쿼리는 `page`, `limit`, `sort=-createdAt`, 선택적 `q`만 보낸다. `limit`은 10이며 스펙상 상한은 50이다.
8. `this.posts = result.data`가 최소 예의 `posts = (await ...).data`와 같은 자리다.
9. `create` 본문은 `title`, `body`, `tags`다.
10. `patch`는 제목만 보낸다. 보내지 않은 `body`는 서버가 유지해야 한다.
11. `remove`는 `DELETE` 후 목록을 다시 읽는다.
12. 화면의 `x-init="init()"`가 첫 로드를 시작한다.
13. `@change`로 검색어가 바뀌면 `page`를 1로 되돌리고 서버에 `q`를 다시 묻는다.

## ④ 🔗 연동 포인트

`API_BASE`는 `.env`에서 오고 Git에는 `.env.example`만 남긴다. 같은 클라이언트가 댓글을 붙일 때는 `GET /api/posts/{id}/comments`, `POST /api/posts/{id}/comments`, `DELETE /api/comments/{id}`를 이 `api()`에 그대로 태운다. 쓰기 메서드는 study7이 `Authorization` 헤더를 추가하기 전까지 401일 수 있다. 헬스 확인은 접두어 없는 `GET /health`라서 `api()`의 `/api` 규칙과 따로 `fetch(base() + '/health')`를 호출한다. 배포 환경의 `API_BASE`만 바꾸면 화면 코드는 유지된다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 목록이 비고 콘솔은 성공 | `posts = body`로 감싸진 객체를 배열처럼 반복 | `body.data`를 할당한다 |
| 삭제 후 `Unexpected token` | 204에 `response.json()` | 상태 204는 JSON 파싱을 건너뛴다 |
| CORS 오류로 목록 실패 | API의 허용 출처에 페이지 원점이 없음 | 서버 `CORS_ORIGIN`에 `http://127.0.0.1:5500`을 넣는다. 브라우저 코드로 CORS를 풀 수 없다 |
| 검색이 대소문자만 다름 | 최소 예의 `includes`는 페이지 안 필터 | 스펙의 `q`는 서버가 대소문자 무시로 처리하게 쿼리로 보낸다 |
| PATCH가 본문을 지움 | 빈 문자열까지 본문에 실음 | 바꾼 필드만 JSON에 넣는다 |
| `API_BASE`가 저장소에 비밀과 함께 커밋 | `.env` 전체를 `config.js`로 복사 | 공개 원점만 남기고 키 이름이 `PASSWORD`나 `SECRET`이면 파일을 만들지 않는다 |

## ⑥ 직접 해보기

1. Network 패널에서 목록 요청의 쿼리에 `sort=-createdAt`이 있는지 본다.
2. 없는 id로 `GET /api/posts/999999`을 임시 버튼에 연결해 `404`의 `error.code`가 `NOT_FOUND`인지 확인한다.
3. `config.js`의 원점을 잘못된 포트로 바꿔 메시지가 화면에 남는 것을 본 뒤 되돌린다.

## ⑦ ☐ 체크리스트

- [ ] `fetch` 로 게시판 API 목록 불러오기 (`x-init`)
- [ ] `API_BASE`는 `window.__CONFIG`에만 있고 DB 비밀번호는 없다
- [ ] 목록은 `data`와 `meta.page/limit/total/totalPages/q`를 쓴다
- [ ] 상세·등록(`201`)·`PATCH`·`DELETE`(`204`)가 한 `api()`를 탄다
- [ ] 오류는 `error.code`, `error.message`, `error.fields`, `error.requestId`를 본다
- [ ] 쿼리는 `q`, `page`, `limit`, `sort`만 보낸다
- [ ] 헬스 체크 경로 `/health`와 `/api/...`를 구분했다

## ⑧ 다음 단계

study7에서 같은 `api()`에 로그인 스토어의 토큰을 붙이고, 작성자만 수정·삭제 버튼을 보게 만든다.
