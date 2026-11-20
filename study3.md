# study3. 데이터 다루기

## ① 목표

컴포넌트 상태, `Alpine.store`, `x-model` 바인딩, `localStorage` 저장을 한 페이지에서 구분한다.

## ② 📖 이론

### 왜 쓰는지

study2의 `posts`는 `boardShell` 안에 있어서 그 요소 바깥에서는 보이지 않는다. 로그인 사용자나 글 목록처럼 여러 컴포넌트가 같은 값을 본다면 스토어가 맞다. 새로고침 뒤에도 남을 초안은 저장소가 맞다. 모달의 `open`처럼 그 컴포넌트만의 값은 로컬 상태로 남긴다.

### 핵심 개념

- **로컬 상태**: `Alpine.data`가 반환한 객체의 필드. 컴포넌트가 사라지면 함께 사라진다.
- **스토어**: `Alpine.store('posts', { items: [], set(items) { this.items = items } })`. 템플릿에서는 `$store.posts.items`, 스크립트에서는 `Alpine.store('posts')`.
- **바인딩**: `x-model`은 입력과 필드를 맞춘다. `:value`만 주면 화면은 따라오지만 입력이 상태를 고치지는 않는다. `x-text`는 상태에서 화면으로만 간다.
- **반응성**: Alpine 3은 상태 객체를 프록시로 감싼다. 이미 있는 배열의 `push`, 필드의 재할당은 화면을 갱신한다. `x-data`에 없던 목적을 나중에 몰래 추가하기보다 초기 값으로 선언한다.
- **`localStorage`**: 문자열만 저장한다. 객체는 `JSON.stringify` / `JSON.parse`. 저장 키는 `alpine.draft`처럼 앱 접두어를 붙인다. 토큰과 비밀번호는 여기에 넣지 않는다. 이번 단계의 저장값은 글 초안 문자열뿐이다.
- **`$watch('draft', value => ...)`**: 그 필드가 바뀔 때마다 저장한다.
- **`$persist`**: `@alpinejs/persist` 플러그인의 매직이다. 공식 플러그인이며 Alpine과 같은 3.17.5를 쓴다. 플러그인 스크립트는 Alpine 본체보다 먼저 읽힌다. 이번 예제는 저장 과정을 보이기 위해 `$watch`와 `localStorage`를 직접 쓴다.

### 비유

로컬 상태는 서랍, 스토어는 복도 게시판, `localStorage`는 퇴근 후에도 남는 사물함이다. 사물함에 금고 열쇠(토큰)를 넣으면 같은 브라우저의 다른 스크립트가 꺼낼 수 있으니 초안만 넣는다.

## ③ 🛠️ 실기

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Alpine 데이터</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
  <script>
    const DRAFT_KEY = 'alpine.draft'
    document.addEventListener('alpine:init', () => {
      Alpine.store('posts', {
        items: [
          { id: 1, title: '첫 글', body: '안녕하세요' }
        ],
        upsert(post) {
          const index = this.items.findIndex((item) => item.id === post.id)
          if (index === -1) this.items.push(post)
          else this.items.splice(index, 1, post)
        }
      })
      Alpine.data('editor', () => ({
        draft: localStorage.getItem(DRAFT_KEY) ?? '',
        init() {
          this.$watch('draft', (value) => {
            localStorage.setItem(DRAFT_KEY, value)
          })
        },
        save() {
          const title = this.draft.trim()
          if (!title) return
          const items = Alpine.store('posts').items
          const nextId = items.reduce((max, item) => Math.max(max, item.id), 0) + 1
          Alpine.store('posts').upsert({ id: nextId, title, body: title })
          this.draft = ''
        },
        clearDraft() {
          this.draft = ''
          localStorage.removeItem(DRAFT_KEY)
        }
      }))
    })
  </script>
</head>
<body>
  <section x-data>
    <template x-for="post in $store.posts.items" :key="post.id">
      <p>
        <span x-text="post.title"></span>
        <input :value="post.title" readonly>
      </p>
    </template>
  </section>
  <form x-data="editor" @submit.prevent="save()">
    <label>
      초안
      <input x-model="draft">
    </label>
    <button type="submit">목록에 추가</button>
    <button type="button" @click="clearDraft()">초안 삭제</button>
  </form>
</body>
</html>
```

개발자도구 Application → Local Storage에서 `alpine.draft`가 입력과 같이 바뀌는지 확인한다. 새로고침 뒤 입력칸이 마지막 초안을 복원하는지 본다. 추가 버튼을 누른 뒤 Elements에서 새 `p`가 생기는지 본다.

### 줄별 설명

1. 저장 키를 한 상수로 둔다.
2. `Alpine.store('posts')`는 페이지의 어느 스코프에서나 `$store.posts`로 보인다.
3. `items`는 목록의 단일 출처다.
4. `upsert`는 id가 있으면 그 자리만 갈아끼우고, 없으면 `push`한다. 배열을 통째로 다른 참조로 바꾸는 대신 프록시 배열을 고친다.
5. `editor.draft`의 초기값은 저장소다. 키가 없으면 빈 문자열이다.
6. `init`은 컴포넌트가 준비되면 Alpine이 호출한다.
7. `$watch`는 `draft`의 이후 변경만 저장한다. 초기 복원 때 불필요하게 다시 쓰려면 `init` 안에서 한 번 더 `setItem`해도 된다.
8. `save`는 공백 초안을 무시한다.
9. 다음 id는 현재 스토어의 최대 id에 1을 더한 값이다. 서버 id가 생기기 전의 로컬 규칙이다.
10. `upsert`에 제목과 본문이 같은 임시 글을 넣는다.
11. `this.draft = ''`는 입력을 비우고 `$watch`를 통해 저장소도 비운다.
12. `clearDraft`는 메모리와 저장소를 함께 지운다.
13. 목록 섹션의 빈 `x-data`가 스코프를 만든다. `template`은 그 안에서 `$store.posts.items`를 읽는다.
14. `:key="post.id"`는 스토어 항목의 id다.
15. `x-text`는 상태에서 화면으로만 간다.
16. `:value`는 보여 주기만 한다. `readonly`라 이 입력이 스토어를 고치지 않는다.
17. 폼의 `@submit.prevent`는 새로고침 없이 `save`를 호출한다.
18. `x-model="draft"`는 입력과 `editor.draft`의 양방향 바인딩이다.

## ④ 🔗 연동 포인트

스토어 `posts.items`는 study6에서 API의 `data` 배열로 `set`된다. 초안 키 `alpine.draft`는 이 브라우저에만 있다. 서버 저장은 `POST /api/posts`가 성공한 뒤에만 하고, 그때 로컬 초안을 비운다. study7의 로그인 사용자는 같은 `Alpine.store` 문법을 쓰되 키 이름을 `auth`로 나누고, 토큰은 `localStorage`에 넣지 않는다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `$store.posts is undefined` | 스토어 등록보다 평가가 먼저이거나 이름 오타 | `alpine:init`에서 `Alpine.store`를 호출한다 |
| 새로고침하면 초안이 사라짐 | `$watch`를 안 걸었거나 다른 키를 읽음 | 읽고 쓰는 키를 `alpine.draft` 하나로 맞춘다 |
| `JSON.parse`가 예외 | 저장소에 사람이 깨진 문자열을 넣음 | 이번 예제는 문자열이므로 parse하지 않는다. 객체를 넣을 때만 try/catch로 빈 값을 돌려준다 |
| 목록이 안 바뀜 | 스토어 바깥의 복사 배열만 수정 | `Alpine.store('posts').items`를 직접 수정한다 |
| 입력은 바뀌는데 제목이 그대로 | `x-model` 대신 `:value`만 연결 | 편집 칸은 `x-model`, 읽기 칸은 `x-text`로 나눈다 |
| 비밀번호가 Local Storage에 보임 | 비밀을 `draft`와 같은 경로에 저장 | 비밀 입력은 저장소 감시 대상에서 뺀다 |

## ⑥ 직접 해보기

1. 스토어에 `remove(id)`를 만들고 각 행에 삭제 버튼을 단다. `localStorage`의 초안은 그대로인지 확인한다.
2. `draft`가 바뀌는 횟수를 세는 필드를 `$watch` 안에 추가하고, 한 글자마다 증가하는지 본다.
3. Application 패널에서 `alpine.draft`를 직접 지운 뒤 새로고침해 입력이 빈 문자열이 되는지 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 컴포넌트만의 `draft`와 스토어의 `items`를 구분했다
- [ ] 목록은 `$store.posts.items`만 읽는다
- [ ] 편집 입력은 `x-model`, 읽기 입력은 `:value`다
- [ ] 초안은 `localStorage` 키 `alpine.draft`에 문자열로 남는다
- [ ] 새로고침 후 초안이 복원된다
- [ ] 토큰·비밀번호·API 키는 저장하지 않았다

## ⑧ 다음 단계

study4에서 스토어의 글 id를 해시 주소와 연결하고, 없는 id는 오류 화면으로 보낸다.
