# studymidpoint. 작은 게시판

## ① 목표

study0~study10에서 만든 Alpine.js 3.17.5 조각만으로, 로그인과 글 CRUD가 있는 단일 정적 게시판을 설계한다.

## ② 📖 이론

### 왜 쓰는지

조각 예제는 디렉티브 하나를 보여 준다. 서비스는 그 조각이 같은 스토어와 같은 `api()`를 볼 때 성립한다. 이 문서는 새 라이브러리를 더하지 않고, 이미 정한 해시 라우터·폼·스펙 v1·`auth` 스토어를 한 화면 흐름으로 묶는다.

### 핵심 개념

화면은 `index.html` 하나다. 서버 렌더링 엔진을 추가하지 않는다. 데이터는 `API_BASE` 뒤의 스펙 v1이며, Alpine은 DB에 접속하지 않는다. 로그인은 `Alpine.store('auth')`다.

### 비유

지금까지의 노트가 부품이라면 이 문서는 같은 부품으로 접는 한 대의 서랍장이다. 서랍 안에 다른 제품의 레일을 끼우지 않는다.

## 기능 목록

- 이메일·비밀번호 로그인, 로그아웃, `GET /api/auth/me`로 새로고침 복원(쿠키 방식) 또는 메모리 토큰(분리 원점)
- `#/posts` 목록: `q`, `page`, `limit=10`, `sort=-createdAt`
- `#/posts/{id}` 상세와 댓글 목록 `GET /api/posts/{id}/comments`
- 로그인 사용자만 `#/write`, 자신의 글만 수정·삭제
- 댓글 작성 `POST /api/posts/{id}/comments`, 자신의 댓글만 `DELETE /api/comments/{id}`
- 검증 실패는 `error.fields`, 그 외는 `error.message`와 `requestId`
- 없는 경로는 오류 화면

## 폴더 구조

```text
index.html
css/app.css
js/config.js
js/config.example.js
js/pure.js
js/api.js
js/stores.js
js/components.js
js/pure.test.mjs
.env.example
.gitignore
```

`components.js`에 `router`, `postList`, `postDetail`, `writer`, `loginForm`을 둔다. 각 컴포넌트는 study2의 `Alpine.data` 형식이다.

## 단계별 구현 순서

1. study0 폴더와 3.17.5 CDN, `.gitignore`, `.env.example`.
2. study8 순서로 `config.js`, `pure.js`, `api.js`, `stores.js`를 연결한다.
3. `auth` 스토어와 로그인 폼(study7). 앱 시작 시 쿠키 방식이면 `/api/auth/me`를 한 번 호출한다.
4. `parseHash`(study4)로 `list`, `detail`, `write`, `notfound`를 나눈다.
5. 목록 `x-init`에서 `GET /api/posts`(study6의 최소 예와 같은 `.data` 대입).
6. 작성 폼은 study5의 `validatePost`, `submitting`, `201`이면 `#/posts/{id}`로 이동.
7. 상세는 `GET /api/posts/{id}`. `404`면 "글을 찾을 수 없습니다".
8. 수정은 `PATCH`, 삭제는 `DELETE`. 버튼은 `author.id`가 같을 때만.
9. 댓글 목록과 작성. 삭제 응답 `204`는 JSON으로 읽지 않는다.
10. study9 테스트를 돌리고, study10 점검표로 로컬 서버를 확인한다.

### 목록을 시작하는 코드

```html
<div x-data="postList" x-init="load()">
  <input x-model="q" @change="load(1)">
  <template x-for="post in posts" :key="post.id">
    <article>
      <a :href="'#/posts/' + post.id" x-text="post.title"></a>
      <span x-text="post.author.nickname"></span>
      <span x-text="post.commentCount"></span>
    </article>
  </template>
  <button type="button" @click="load(meta.page - 1)" :disabled="meta.page <= 1">이전</button>
  <button type="button" @click="load(meta.page + 1)" :disabled="meta.page >= meta.totalPages">다음</button>
</div>
```

```javascript
Alpine.data('postList', () => ({
  posts: [],
  q: '',
  meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
  message: '',
  async load(page = 1) {
    const params = new URLSearchParams({ page: String(page), limit: '10', sort: '-createdAt' })
    if (this.q.trim()) params.set('q', this.q.trim())
    try {
      const result = await api('/api/posts?' + params.toString())
      this.posts = result.data
      this.meta = result.meta
      this.message = ''
    } catch (error) {
      this.message = error.message
    }
  }
}))
```

### 줄별 설명

1. `x-init="load()"`가 첫 목록 요청이다. `init()` 메서드를 또 만들지 않는다.
2. 검색 변경 시 `page`를 1로 서버에 다시 묻는다.
3. `:key`는 `post.id`다.
4. 상세 이동은 해시 링크다. API 경로와 id 숫자가 같다.
5. `author.nickname`과 `commentCount`는 스펙 필드이며 `x-text`로만 출력한다.
6. 이전·다음은 `meta.page`와 `meta.totalPages`로 비활성화한다.
7. `load`는 `data`를 `posts`에, `meta`를 페이지 상태에 넣는다.
8. 실패 시 목록을 빈 배열로 속이지 않고 기존 목록을 유지한 채 `message`만 바꾼다. 첫 로드 실패면 목록은 초기 빈 배열이다.

## DB·API 연동 구성도

```text
브라우저 index.html (Alpine 3.17.5)
  js/config.js  API_BASE  (공개 HTTPS 또는 로컬 http)
  js/api.js     Authorization 은 auth 스토어의 메모리 토큰일 때만
        |  GET /health
        |  POST /api/auth/signup|login|logout
        |  GET  /api/auth/me
        |  GET/POST /api/posts
        |  GET/PATCH/DELETE /api/posts/{id}
        |  GET/POST /api/posts/{id}/comments
        |  DELETE /api/comments/{id}
        v
스펙 v1을 지키는 API
        |
        v
API 서버 안의 DB  (Alpine 설정에 없음)
```

로컬 초안만 `localStorage` 키 `alpine.draft`에 둔다. 글의 기준 저장소는 API다.

## 1차 배포 체크리스트

- [ ] CDN이 `alpinejs@3.17.5`이고 `Alpine.version`이 같다
- [ ] `.env`와 `config.js`가 배포 폴더의 Git 추적에 없다
- [ ] 운영 `API_BASE`가 `https://`다
- [ ] 비로그인 목록·상세가 200이다
- [ ] 비로그인 작성은 401이고 비밀번호가 저장소에 없다
- [ ] 작성자만 수정·삭제가 보이고, 타인의 삭제는 403 메시지를 낸다
- [ ] `201` 뒤에 상세 해시로 이동한다
- [ ] `204` 삭제 후 JSON 파싱 오류가 없다
- [ ] `#/nope` 오류 화면이 있다
- [ ] `node --test js/pure.test.mjs`가 통과한다

## 회고

- 잘 된 점: 화면이 스펙의 `data`/`error`만 의존하므로 API 구현 언어가 바뀌어도 Alpine 파일을 고치지 않는다.
- 한계: 해시 라우터는 주소창에 `#`이 남고, 서버가 경로별로 다른 HTML을 주지 않는다. 새로고침 유지형 로그인은 쿠키 방식이 아니면 불가능하다.
- 일부러 하지 않은 것: 다른 UI 프레임워크, DB 드라이버, 서버 템플릿 엔진.
- 다음에 볼 것: study11에서 저장 어댑터를 나눈 뒤에도 이 화면의 `api()` 호출이 유지되는지 확인한다.

## ③ 🛠️ 실기

구현 순서 5의 `postList`가 이 서비스의 첫 화면이다. 상세·작성·로그인은 study4~7의 컴포넌트를 `components.js`로 옮기되 함수 이름은 유지한다.

## ④ 🔗 연동 포인트

이 게시판의 `api()`와 `auth` 스토어가 study11 이후의 클라이언트 경계다. DB를 바꿔도 이 문서의 해시와 컴포넌트 이름은 유지한다. 배포 점검표는 study10을 그대로 쓰고, 댓글 경로만 추가한다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 목록은 되는데 작성만 실패 | 토큰 헤더가 `api()`에 없음 | study7 래퍼 한 곳만 사용한다 |
| 댓글 삭제가 문법 오류 | 204를 JSON으로 읽음 | `api()`의 204 분기를 유지한다 |
| 페이지를 넘겨도 같은 글 | `page` 쿼리를 안 바꿈 | `load(meta.page + 1)`가 쿼리를 다시 만든다 |
| 새로고침하면 작성 중이 사라짐 | 라우트가 서버 경로 | 해시를 유지하는지 주소창을 본다 |

## ⑥ 직접 해보기

1. 검색어를 넣고 2페이지로 이동한 뒤 새로고침해 `q`와 `page`가 해시에 없으면 라우터 링크에 쿼리를 포함한다.
2. 다른 사용자 id로 가정한 글에 수정 버튼이 없는지, 직접 `PATCH`를 호출하면 403 메시지가 남는지 본다.
3. 배포 목록에서 `pure.test.mjs`가 빠졌는지 파일 목록을 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 기능 목록의 인증·CRUD·댓글·오류 화면이 스펙 경로와 연결된다
- [ ] 새 프레임워크 스크립트가 `index.html`에 없다
- [ ] `x-init` 목록 로드가 `.data`를 사용한다
- [ ] 1차 배포 체크리스트의 보안 항목을 로컬에서 한 번씩 봤다
- [ ] 회고의 한계(해시, 토큰 유지)를 운영 설명에 적었다

## ⑧ 다음 단계

study11에서 API 뒤의 저장소가 바뀌어도 이 `postList`가 같은 JSON만 보도록 어댑터 경계를 문서화한다.
