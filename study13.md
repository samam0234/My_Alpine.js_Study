# study13. 외부 서비스 연동

## ① 목표

파일, 메일, 결제, OAuth를 Alpine 화면에서는 "내 API에 요청하거나 그 API가 준 주소로 이동"하는 단계로만 연결한다.

## ② 📖 이론

### 왜 쓰는지

결제 비밀 키, SMTP 비밀번호, OAuth 클라이언트 시크릿을 브라우저에 두면 그 페이지를 연 사람이 같은 권한으로 요청을 만들 수 있다. Alpine이 할 수 있는 일은 사용자가 고른 파일을 내 API에 올리고, 메일을 보내 달라는 내용만 전달하고, 결제 페이지로 이동하고, OAuth 제공자가 돌려보낸 쿼리를 읽어 성공·실패 문장을 보여 주는 것이다.

### 핵심 개념

- **파일**: `input type="file"`의 `files[0]`을 `FormData`에 넣는다. `Content-Type`을 직접 `application/json`으로 두면 경계 문자열이 사라져 업로드가 깨진다. `api()`를 쓸 때 업로드만 헤더에서 JSON 타입을 빼야 한다. 실패 `413`은 `PAYLOAD_TOO_LARGE`다.
- **메일**: 화면은 `{ toUserId, subject, text }`처럼 수신자의 비밀이 아닌 필드만 `POST /api/notifications/email`로 보낸다. SMTP 주소는 서버 환경 변수다. 이 경로는 스펙 v1의 게시판 표에는 없으므로 같은 오류 형식 `{ error }`만 재사용한다.
- **결제**: 버튼이 `POST /api/checkout`을 호출하면 서버가 `{ data: { url } }`을 준다. Alpine은 `location.assign(data.url)`만 한다. 카드 번호를 `x-model`에 받지 않는다.
- **OAuth**: 로그인 버튼은 서버 시작 주소 `/api/auth/oauth/github`로 이동한다. 복귀 페이지는 `?error=`가 있으면 그 코드를 문장으로 바꾸고, 없으면 `GET /api/auth/me`로 `auth` 스토어를 채운다. 클라이언트 시크릿 파라미터를 붙이지 않는다.

### 비유

Alpine은 창구 번호표를 뽑는 역할이다. 금고를 여는 열쇠는 창구 뒤에 있고, 번호표에는 "파일을 받았다"와 "결제 페이지로 가라"만 적힌다.

## ③ 🛠️ 실기

```html
<div x-data="extras">
  <input type="file" x-ref="file" @change="selected = $refs.file.files[0] || null">
  <button type="button" @click="upload()" :disabled="busy || !selected">업로드</button>
  <p x-text="message"></p>
  <button type="button" @click="askMail()" :disabled="busy">안내 메일 요청</button>
  <button type="button" @click="startCheckout()" :disabled="busy">결제로 이동</button>
  <a href="/api/auth/oauth/github">GitHub로 로그인</a>
</div>
```

```javascript
Alpine.data('extras', () => ({
  selected: null,
  busy: false,
  message: '',
  async upload() {
    if (!this.selected || this.busy) return
    this.busy = true
    this.message = ''
    try {
      const body = new FormData()
      body.append('file', this.selected)
      const headers = { 'Accept': 'application/json' }
      const token = Alpine.store('auth').token
      if (token) headers.Authorization = 'Bearer ' + token
      const response = await fetch(apiBase() + '/api/uploads', { method: 'POST', headers, body })
      const json = await response.json().catch(() => ({}))
      if (response.status === 413) {
        this.message = json.error?.message || '파일이 너무 큽니다.'
        return
      }
      if (!response.ok) {
        this.message = json.error?.message || '업로드하지 못했습니다.'
        return
      }
      this.message = '받았음 id ' + json.data.id
      this.selected = null
    } finally {
      this.busy = false
    }
  },
  async askMail() {
    this.busy = true
    try {
      await api('/api/notifications/email', { method: 'POST', body: JSON.stringify({ subject: '안내', text: '확인 메일' }) })
      this.message = '메일 요청을 접수했습니다.'
    } catch (error) {
      this.message = error.message
    } finally {
      this.busy = false
    }
  },
  async startCheckout() {
    this.busy = true
    try {
      const result = await api('/api/checkout', { method: 'POST', body: JSON.stringify({ purpose: 'study' }) })
      const url = String(result.data?.url || '')
      if (!url.startsWith('https://')) throw new Error('이동할 주소가 없습니다.')
      location.assign(url)
    } catch (error) {
      this.message = error.message
      this.busy = false
    }
  }
}))
```

OAuth 복귀 화면의 `x-init`:

```javascript
async init() {
  const error = new URLSearchParams(location.search).get('error')
  if (error) { this.message = '로그인 제공자가 요청을 끝내지 못했습니다.'; return }
  const result = await api('/api/auth/me')
  Alpine.store('auth').setSession({ user: result.data, accessToken: '' })
}
```

쿠키 세션이면 `accessToken`은 빈 문자열이다. 스토어의 사용자만 채운다.

### 줄별 설명

1. 파일은 `$refs.file.files[0]`으로 고른다. 파일 내용을 스토어에 복사해 두지 않는다.
2. `FormData`는 브라우저가 `multipart` 경계를 만들게 한다.
3. 업로드 `fetch`는 `Content-Type`을 직접 넣지 않는다.
4. `413`은 스펙 코드 `PAYLOAD_TOO_LARGE`의 상태다. 화면은 `error.message`만 쓴다.
5. 메일 API에는 SMTP 호스트를 보내지 않는다.
6. 결제 응답에 `url`이 없으면 이동하지 않는다. `url`이 `https://`가 아니면 이동하지 않는 검사를 `startCheckout`에 추가하는 것이 안전하다.
7. OAuth 링크는 서버 경로다. 쿼리에 `client_secret`이 없다.
8. 복귀 페이지의 `error` 쿼리는 사용자에게 원문 코드 나열이 아니라 짧은 실패 문장으로 바꾼다.

## ④ 🔗 연동 포인트

업로드가 성공하면 `data.id`를 글 작성 폼의 첨부 id로 가지고 있다가 `POST /api/posts` 본문에 서버가 허용한 필드가 있을 때만 넣는다. 스펙 v1 본문에는 첨부 필드가 없으므로, 없는 필드를 임의로 추가하지 않고 업로드 id는 화면 상태로만 둔다. 결제는 외부 페이지가 끝난 뒤 내 사이트의 `#/posts`로 돌아오는 주소를 서버가 만든다. Alpine은 그 복귀 해시에서 결제 성공을 단정하지 않고 서버 상태 API가 있을 때만 문장을 바꾼다. OAuth 성공은 `auth` 스토어가 study7과 같은 `user` 모양일 때만 목록의 작성 버튼을 연다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 서버가 파일을 못 받음 | `Content-Type: application/json`을 강제 | 업로드 요청에서 그 헤더를 뺀다 |
| 413인데 성공 처리 | `response.ok`만 봄 | 413을 먼저 분기한다. `ok`는 413에서 거짓이다 |
| 메일 버튼이 SMTP 오류 원문을 표시 | 서버가 예외 문자열을 `message`에 넣음 | 화면은 짧은 실패 문장만 보여 준다 |
| 결제 주소가 `javascript:` | `data.url`을 검사하지 않음 | `https://`로 시작할 때만 `assign` 한다 |
| OAuth 복귀에 토큰이 쿼리로 보임 | 서버가 액세스 토큰을 쿼리로 돌려줌 | 쿼리의 토큰을 스토어에 저장하지 않는다. 쿠키 또는 조각이 아닌 서버 세션으로 바꾼다 |
| 비밀 키가 번들에 있음 | 결제·OAuth 비밀을 `config.js`에 추가 | 공개 `API_BASE`만 유지한다 |

## ⑥ 직접 해보기

1. 파일을 고르기 전에 업로드 버튼이 비활성인지 본다.
2. `data.url`이 `http://127.0.0.1`인 응답을 가짜로 넣어 `https://` 검사가 이동을 막는지 확인한다.
3. 복귀 URL에 `?error=access_denied`를 붙여 짧은 실패 문장만 보이는지 본다.

## ⑦ ☐ 체크리스트

- [ ] 업로드는 `FormData`이고 JSON 타입을 강제하지 않는다
- [ ] `413`과 그 외 오류를 `error.message`로 보여 준다
- [ ] 메일 요청 본문에 SMTP 비밀번호가 없다
- [ ] 결제 화면은 카드 번호를 받지 않고 `https://` URL로만 이동한다
- [ ] OAuth 시작 주소에 클라이언트 시크릿이 없다
- [ ] 복귀 토큰을 쿼리에서 `localStorage`로 옮기지 않는다
- [ ] `busy`가 업로드·메일·결제의 중복 클릭을 막는다

## ⑧ 다음 단계

study14에서 이 요청들이 공통으로 따르는 경로 이름, 페이지네이션, 오류 형식, OpenAPI 문서를 Alpine이 어떻게 읽는지 정리한다.
