# study4. 라우팅과 요청 처리

## ① 목표

Alpine 페이지 안에서 해시 URL로 목록·상세·오류 화면을 바꾸고, 쿼리와 동적 id를 읽는다.

## ② 📖 이론

### 왜 쓰는지

Alpine은 서버를 대신하는 라우터를 내장하지 않는다. 서버가 HTML 파일 하나를 주고, 그 안의 화면 전환은 주소 해시에 남길 수 있다. `#/posts/3?q=안녕`처럼 적으면 새로고침 뒤에도 같은 화면을 다시 그릴 수 있고, 브라우저의 뒤가 동작을 한다.

### 핵심 개념

- **해시 경로**: `location.hash`에서 `#`을 뺀 나머지를 경로와 쿼리로 나눈다. 서버는 `#` 뒤를 받지 않으므로 정적 파일 서버와 충돌하지 않는다.
- **동적 경로**: `#/posts/3`의 `3`을 `id`로 캡처한다. 숫자가 아니면 오류 화면이다.
- **쿼리**: `#/posts?q=안녕&page=2`를 `URLSearchParams`로 읽는다. `q`와 `page`는 공통 스펙의 목록 쿼리와 같은 이름이다.
- **요청·응답 흐름**: 주소가 바뀌면 `hashchange`가 라우터 상태를 갱신하고, 상세 화면은 그 다음 `fetch`로 `GET /api/posts/{id}`를 호출한다. 이번 장의 예제는 네트워크 없이 스토어를 조회해 흐름만 고정한다. 실제 `fetch`는 study6에 붙인다.
- **오류 화면**: 알 수 없는 경로는 `notfound`, 형식은 맞지만 글이 없으면 `missing`이다. 둘 다 본문 한 화면으로 보여 주고 목록 링크를 남긴다.
- **페이지 이동**: `<a href="#/posts/1">`가 기본 이동이다. 스크립트에서는 `location.hash = '#/posts'`로 옮긴다. Alpine이 클릭을 가로채지 않는다.

### 비유

해시는 같은 책갈피 카드 위의 쪽 번호다. 책을 다시 펴도(새로고침) 쪽 번호가 남아 있고, 서버 서재는 카드 앞면(`index.html`)만 건넨다.

## ③ 🛠️ 실기

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Alpine 라우터</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
  <script>
    function parseHash(hash) {
      const raw = (hash || '#/posts').replace(/^#/, '')
      const [pathPart, queryPart = ''] = raw.split('?')
      const path = pathPart.startsWith('/') ? pathPart : '/' + pathPart
      const query = Object.fromEntries(new URLSearchParams(queryPart))
      const detail = path.match(/^\/posts\/([^/]+)$/)
      if (path === '/posts') return { name: 'list', query }
      if (detail) return { name: 'detail', id: detail[1], query }
      return { name: 'notfound', path, query }
    }

    document.addEventListener('alpine:init', () => {
      Alpine.store('posts', {
        items: [
          { id: 1, title: '첫 글', body: '안녕하세요' },
          { id: 2, title: '둘째 글', body: '라우터' }
        ]
      })
      Alpine.data('router', () => ({
        route: parseHash(location.hash),
        init() {
          if (!location.hash) location.hash = '#/posts'
          window.addEventListener('hashchange', () => {
            this.route = parseHash(location.hash)
          })
        },
        detailItem() {
          const id = Number(this.route.id)
          if (!Number.isInteger(id)) return null
          return Alpine.store('posts').items.find((item) => item.id === id) ?? null
        },
        goList() { location.hash = '#/posts' }
      }))
    })
  </script>
</head>
<body x-data="router">
  <nav>
    <a href="#/posts">목록</a>
    <a href="#/posts?q=첫&page=1">검색 예</a>
    <a href="#/nope">없는 경로</a>
  </nav>

  <template x-if="route.name === 'list'">
    <section>
      <p>q=<span x-text="route.query.q ?? ''"></span>, page=<span x-text="route.query.page ?? '1'"></span></p>
      <template x-for="post in $store.posts.items.filter(post => !route.query.q || post.title.includes(route.query.q))" :key="post.id">
        <p><a :href="'#/posts/' + post.id" x-text="post.title"></a></p>
      </template>
    </section>
  </template>

  <template x-if="route.name === 'detail'">
    <section>
      <template x-if="detailItem()">
        <article>
          <h1 x-text="detailItem().title"></h1>
          <p x-text="detailItem().body"></p>
        </article>
      </template>
      <template x-if="!detailItem()">
        <p>글을 찾을 수 없습니다. <button type="button" @click="goList()">목록</button></p>
      </template>
    </section>
  </template>

  <template x-if="route.name === 'notfound'">
    <section>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p x-text="route.path"></p>
      <a href="#/posts">목록으로</a>
    </section>
  </template>
</body>
</html>
```

확인: `#/posts/1`은 첫 글, `#/posts/9`는 없음 문구, `#/posts?q=첫&page=2`는 쿼리 문장, `#/nope`은 오류 화면, 브라우저 뒤로 가기가 이전 해시를 복원한다.

### 줄별 설명

`parseHash`

1. 해시가 없으면 목록으로 본다. `#`만 제거한다.
2. `?` 앞은 경로, 뒤는 쿼리 문자열이다.
3. 선행 슬래시가 없으면 붙인다.
4. 쿼리를 객체로 만든다. 같은 키가 여러 번이면 마지막 값만 남는다.
5. `#/posts/값`만 상세로 인정한다.
6. `#/posts`는 목록이다. 쿼리는 그대로 둔다.
7. 상세는 id를 문자열로 보관한다. 숫자 검증은 `detailItem`이 한다.
8. 그 외는 `notfound`다.

라우터 컴포넌트:

1. 초기 `route`는 현재 해시다.
2. `init`에서 빈 해시를 `#/posts`로 맞춘다.
3. `hashchange`마다 `route`를 갈아끼운다. Alpine이 해당 `x-if`를 다시 그린다.
4. `detailItem`은 id가 정수가 아니거나 스토어에 없으면 `null`이다.
5. `goList`는 주소를 바꿔 `hashchange`가 화면을 바꾸게 한다.
6. 목록의 `:href`는 상세 해시를 만든다. 전체 페이지 요청이 아니다.
7. 상세와 없음, 경로 오류는 서로 다른 `x-if`다.

## ④ 🔗 연동 포인트

쿼리 이름 `q`, `page`는 공통 스펙 `GET /api/posts?q&page&limit&sort`와 맞춘다. study6에서 목록 화면의 `x-init`이 `route.query`를 그대로 쿼리스트링에 실어 보낸다. 프론트 해시 `#/posts/3`과 API 경로 `/api/posts/3`은 숫자가 같고 접두어만 다르다. 서버 HTML 라우트가 있다면 서버는 `index.html` 하나를 주고, 글 식별자는 해시 또는 서버 경로 중 한쪽에만 둔다. 둘 다 서로 다른 id를 쓰면 새로고침할 때 다른 글이 열린다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 새로고침하면 항상 목록 | `init`이 현재 해시를 덮어씀 | 해시가 있을 때는 `location.hash`를 유지한다 |
| 상세가 안 바뀜 | `route` 객체의 필드만 고치고 재할당을 안 함 | `this.route = parseHash(...)`로 객체 전체를 바꾼다 |
| `#/posts/01`이 1번 글과 섞임 | 문자열 비교와 숫자 비교가 섞임 | 화면 id는 `Number` 후 정수인지 확인한다 |
| 쿼리 한글이 깨짐 | 해시에 이미 인코딩된 값을 한 번 더 `encodeURIComponent` | `URLSearchParams`가 디코딩하게 두고, 링크를 만들 때만 인코딩한다 |
| 뒤로 가기가 멈춤 | `hashchange` 대신 `click`에서만 상태를 고침 | 이동은 `location.hash`에만 맡긴다 |
| 없는 경로가 빈 화면 | `notfound` 템플릿이 없음 | `route.name` 세 가지를 모두 `x-if`로 둔다 |

## ⑥ 직접 해보기

1. `#/posts/둘째`처럼 숫자가 아닌 id를 열어 `missing`과 같은 "글을 찾을 수 없습니다"가 나오는지 본다.
2. 목록 링크를 `#/posts?q=글&page=2`로 직접 고쳐 두 값이 화면에 같이 보이는지 확인한다.
3. `goList` 대신 `history.back()`을 임시로 넣어, 상세에서 목록으로 돌아갈 때 이전 쿼리가 유지되는지 비교한다.

## ⑦ ☐ 체크리스트

- [ ] `#/posts`, `#/posts/{id}`, 그 외 경로가 서로 다른 화면이다
- [ ] `q`와 `page` 쿼리를 화면에 표시한다
- [ ] 없는 id와 없는 경로는 본문 오류 화면과 목록 링크가 있다
- [ ] 새로고침과 뒤로 가기가 해시를 따른다
- [ ] 프론트 id와 나중에 부를 `/api/posts/{id}`의 id 규칙이 같다
- [ ] 라우터 코드가 Alpine 페이지 안에만 있다

## ⑧ 다음 단계

study5에서 목록 위 작성 화면의 입력을 검증하고, 응답 코드에 따라 오류 문장과 버튼을 바꾼다.
