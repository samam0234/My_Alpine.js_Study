# study17. 실시간·확장

## ① 목표

게시글 알림을 WebSocket으로 받고, 브라우저 알림은 권한 안에서만 띄우며, 선택한 텍스트 파일은 서버로 보내기 전에 브라우저에서 읽는다.

## ② 📖 이론

### 왜 쓰는지

목록을 10초마다 다시 읽으면 글이 없어도 요청이 나간다. 서버가 새 글이 있을 때만 한 줄 JSON을 보내 주면 화면은 그 줄만 반영한다. 파일 전체 처리(바이러스 검사, 영구 저장)는 API가 하고, Alpine은 사용자가 고른 텍스트를 미리 보여 주는 일까지만 한다.

### 핵심 개념

- **WebSocket**: `new WebSocket(wssUrl)`. 메시지 `data`는 문자열로 오고 `JSON.parse`한다. 기대 모양은 `{ type: 'post.created', post: { id, title } }`다. 그 외 `type`은 무시한다.
- **주소**: HTTP API의 `API_BASE`가 `https://api.example.com`이면 소켓은 `wss://api.example.com/ws`다. `ws://`는 로컬 `http://127.0.0.1`에서만 허용한다. 토큰을 쿼리스트링에 붙이지 않는다. 쿠키 인증이 아니면 소켓은 붙이지 않고 목록 갱신 버튼만 둔다.
- **재연결**: 닫히면 2초 뒤 한 번 다시 시도하고, 컴포넌트 파괴 시 `close()`한다. 무한 즉시 재시도는 하지 않는다.
- **알림**: `Notification.requestPermission()`은 버튼 클릭 안에서만 호출한다. 권한이 `granted`일 때만 `new Notification`을 만든다. 본문에는 제목만 넣고 HTML을 넣지 않는다.
- **파일**: `FileReader.readAsText`로 1MB 이하 text/plain 또는 `.md`만 읽는다. 내용을 `x-text`로 미리 본다. 저장은 study13의 업로드 경로로 넘긴다.

### 비유

웹소켓은 창구가 새 주문서를 집어 주는 벨이다. 벨이 고장 나면 손님이 목록 새로고침 버튼을 누를 수 있어야 한다. 벨 줄에 출입증 번호를 적어 두지 않는다.

## ③ 🛠️ 실기

```javascript
Alpine.data('liveBoard', () => ({
  posts: [],
  status: 'idle',
  preview: '',
  socket: null,
  init() {
    this.load()
    this.connect()
  },
  async load() {
    const result = await api('/api/posts?page=1&limit=10&sort=-createdAt')
    this.posts = result.data
  },
  connect() {
    const base = apiBase()
    const local = base.startsWith('http://127.0.0.1')
    if (!base.startsWith('https://') && !local) { this.status = 'off'; return }
    const url = (local ? base.replace('http://', 'ws://') : base.replace('https://', 'wss://')) + '/ws'
    this.socket = new WebSocket(url)
    this.socket.addEventListener('open', () => { this.status = 'on' })
    this.socket.addEventListener('message', (event) => {
      let payload = null
      try { payload = JSON.parse(event.data) } catch { return }
      if (!payload || payload.type !== 'post.created' || !payload.post?.id) return
      this.posts = [payload.post, ...this.posts.filter((item) => item.id !== payload.post.id)].slice(0, 10)
      this.notify(payload.post.title)
    })
    this.socket.addEventListener('close', () => {
      this.status = 'off'
      this.socket = null
    })
  },
  notify(title) {
    if (Notification.permission !== 'granted') return
    new Notification('새 글', { body: String(title).slice(0, 80) })
  },
  askNotify() {
    if ('Notification' in window) Notification.requestPermission()
  },
  readFile(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    if (file.size > 1024 * 1024) { this.preview = '1MB 이하만 미리 봅니다.'; return }
    const reader = new FileReader()
    reader.onload = () => { this.preview = String(reader.result || '').slice(0, 4000) }
    reader.onerror = () => { this.preview = '파일을 읽지 못했습니다.' }
    reader.readAsText(file)
  },
  destroy() {
    if (this.socket) this.socket.close()
  }
}))
```

```html
<div x-data="liveBoard">
  <p x-text="status"></p>
  <button type="button" @click="askNotify()">알림 허용</button>
  <button type="button" @click="load()">목록 새로고침</button>
  <template x-for="post in posts" :key="post.id">
    <p x-text="post.title"></p>
  </template>
  <input type="file" accept=".txt,.md,text/plain" @change="readFile($event)">
  <pre x-text="preview"></pre>
</div>
```

### 줄별 설명

1. `init`은 목록 REST 한 번과 소켓 연결을 같이 시작한다. `x-init`과 이 `init`을 둘 다 쓰지 않는다.
2. `connect`는 HTTPS 또는 로컬 HTTP에서만 소켓을 만든다.
3. URL 치환은 원점의 스킴만 바꾼다. 경로 `/ws`는 고정이다.
4. `message`는 JSON이 아니거나 `type`이 다르면 버린다.
5. 같은 id가 있으면 앞쪽으로 옮기고 10개만 남긴다. 전체 목록 재조회를 대체하지는 않는다. 필드가 부족하면 새로고침 버튼이 `load`로 스펙 전체를 다시 받는다.
6. 알림은 이미 허용된 경우에만 띄운다. `askNotify`만이 권한 창을 연다.
7. 제목은 80자로 자른 텍스트다.
8. 파일은 1MB를 넘으면 읽지 않는다. 미리보기는 4000자까지만 상태에 둔다.
9. `destroy`는 페이지를 떠날 때 소켓을 닫는다. Alpine은 컴포넌트가 제거될 때 `destroy`를 호출한다.
10. 미리보기는 `pre`와 `x-text`라서 HTML로 실행되지 않는다.

## ④ 🔗 연동 포인트

소켓이 알려 준 글은 요약일 수 있다. 상세로 들어갈 때는 항상 `GET /api/posts/{id}`를 호출한다. 소켓이 `off`이면 studymidpoint의 새로고침 버튼이 같은 `load`를 쓴다. 파일 미리보기를 글 본문에 넣을 때는 study5 검증을 다시 통과시키고 `POST /api/posts`로 보낸다. 서버는 소켓 메시지를 권한 있는 공개 글에만 제한한다. 브라우저가 그 검사를 대신하지 않는다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 운영에서 소켓이 바로 닫힘 | `ws://`를 HTTPS 페이지에서 사용 | `wss://`로 맞춘다 |
| 쿼리에 토큰이 보임 | `?token=`으로 인증 | 그 방식을 쓰지 않는다. 쿠키 세션 또는 새로고침 버튼을 쓴다 |
| 알림 권한 창이 무시됨 | 페이지 로드 중 `requestPermission` | 버튼 클릭에서만 호출한다 |
| 알림 본문에 태그가 실행 | HTML 알림을 시도 | `Notification`의 `body`는 텍스트만 둔다 |
| 큰 파일이 탭을 멈춤 | 크기 제한 없음 | 1MB와 4000자 제한을 유지한다 |
| 소켓 메시지의 제목만 있고 본문이 상세에 그대로 남음 | 요약을 상세로 사용 | 상세는 GET으로 다시 받는다 |
| 페이지를 떠나도 소켓이 남음 | `destroy`에서 `close`하지 않음 | `socket.close()`를 호출한다 |

## ⑥ 직접 해보기

1. 로컬이 아닌 `http://` 원점에서 `status`가 `off`이고 소켓 객체가 없는지 본다.
2. `{ "type": "other" }` 메시지를 콘솔에서 처리 함수에 넘겨 목록 길이가 그대로인지 확인한다.
3. 1MB를 넘는 파일을 골라 미리보기 문장만 바뀌고 `FileReader`가 시작되지 않는지 본다.

## ⑦ ☐ 체크리스트

- [ ] 소켓 주소는 `wss://`이고 로컬만 `ws://127.0.0.1`이다
- [ ] 토큰을 소켓 URL에 넣지 않는다
- [ ] 알 수 없는 `type`은 무시한다
- [ ] 알림 권한은 버튼에서만 요청한다
- [ ] 파일 미리보기는 1MB·4000자·`x-text` 제한이다
- [ ] 상세 화면은 소켓 페이로드가 아니라 GET 응답을 쓴다
- [ ] `destroy`가 소켓을 닫는다

## ⑧ 다음 단계

study18에서 문서 초안과 질문을 같은 게시판 화면에서 다루고, 스트리밍 응답과 MCP 도구 이름을 Alpine 쪽에서 받는 방법을 붙인다.
