# study7. 인증·보안 기초

## ① 목표

회원가입·로그인 화면과 `Alpine.store` 로그인 상태를 만들고, 토큰·권한·비밀번호·CORS·XSS·CSRF를 Alpine이 지켜야 할 경계로 정리한다.

## ② 📖 이론

### 왜 쓰는지

글 목록은 공개할 수 있지만 작성·수정·삭제는 누구인지 알아야 한다. Alpine은 비밀번호를 검사하거나 해시로 저장하는 주체가 아니다. 브라우저의 일은 비밀을 서버에만 보내고, 서버가 돌려준 세션을 다음 요청에 싣고, 다른 사람의 글에는 수정 버튼을 그리지 않는 것이다. 버튼을 숨기는 것은 편의를 위한 일이고, 권한의 기준은 서버의 `403`이다.

### 핵심 개념

- **회원가입**: `POST /api/auth/signup`에 `{ email, password, nickname }`. 성공 `201`. 중복 이메일은 `409` `EMAIL_TAKEN`.
- **로그인**: `POST /api/auth/login`. 성공 `200`과 `{ data: { user, accessToken } }`. 실패 `401` `INVALID_CREDENTIALS`. 어느 필드가 틀렸는지는 문장으로 구분하지 않는다.
- **내 정보**: `GET /api/auth/me`. 토큰이 없거나 만료면 `401` `UNAUTHORIZED`.
- **로그아웃**: 쿠키 방식이면 `POST /api/auth/logout` → `204`. Bearer 방식이면 스토어의 토큰을 메모리에서 지운다.
- **스토어**: `Alpine.store('auth')`가 `user`와 `token`의 단일 출처다. 템플릿은 `$store.auth.user`만 본다.
- **비밀번호**: 화면에 해시 알고리즘을 구현해 "암호화됐다"고 하지 않는다. 느린 비밀번호 해시는 서버가 저장 전에 적용한다. Alpine은 입력을 `type="password"`로 두고 `localStorage`에 쓰지 않으며, 응답에 해시가 있으면 그 응답을 화면에 찍지 않고 폐기한다.
- **토큰 위치**: 같은 사이트면 `httpOnly` 쿠키와 `credentials: 'include'`가 XSS에 덜 노출된다. 원점이 다르면 메모리의 Bearer 토큰을 `Authorization`에 붙인다. 어느 쪽이든 `localStorage`에 액세스 토큰을 넣지 않는다.
- **권한**: `post.author.id === $store.auth.user?.id`일 때만 수정·삭제를 그린다. 서버가 `403` `FORBIDDEN`을 주면 버튼을 숨겼더라도 메시지를 보여 준다.
- **CORS**: 브라우저는 페이지 원점과 `API_BASE` 원점이 다르면 사전 요청을 보낸다. 허용 출처는 서버 환경 변수 `CORS_ORIGIN`이다. Alpine 코드에서 서버의 CORS를 끌 수 없다. 쿠키를 쓰면 서버는 특정 출처와 `Allow-Credentials`를 함께 보내야 하며 `*`와 쿠키는 같이 쓰지 않는다.
- **XSS**: 글 본문과 오류는 `x-text`만 사용한다. `x-html`은 개발자가 통제한 정적 문자열에만 쓴다. CDN은 알려진 주소의 3.17.5만 읽는다.
- **CSRF**: 쿠키로 로그인한다면 상태 변경 요청에 서버가 내려 준 CSRF 토큰을 커스텀 헤더로 싣는다. Bearer를 메모리에만 두고 쿠키를 안 쓰면, 다른 사이트가 그 헤더를 대신 붙일 수 없다. 그 경우에도 토큰을 주소나 로그에 찍지 않는다.

### 비유

`auth` 스토어는 방문자 명찰 보관함이다. 명찰은 새로고침하면 다시 `GET /api/auth/me`로 확인하고, 서랍(`localStorage`)에 넣어 두지 않는다. 비밀번호 원문은 창구를 통과하는 즉시 입력칸에서만 지운다.

## ③ 🛠️ 실기

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Alpine 인증</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
  <script>
    const API_BASE = window.__CONFIG?.apiBase || 'http://127.0.0.1:8080'
    document.addEventListener('alpine:init', () => {
      Alpine.store('auth', {
        user: null,
        token: '',
        setSession(data) {
          this.user = data.user
          this.token = data.accessToken || ''
        },
        clear() {
          this.user = null
          this.token = ''
        }
      })
      Alpine.data('loginForm', () => ({
        email: '',
        password: '',
        message: '',
        async login() {
          this.message = ''
          const response = await fetch(API_BASE + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json' },
            body: JSON.stringify({ email: this.email, password: this.password })
          })
          const body = await response.json().catch(() => ({}))
          this.password = ''
          if (!response.ok) {
            this.message = body.error?.message || '로그인하지 못했습니다.'
            return
          }
          Alpine.store('auth').setSession(body.data)
        }
      }))
    })

    async function api(path, options = {}) {
      const headers = { 'Accept': 'application/json', ...(options.body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}), ...(options.headers || {}) }
      const token = Alpine.store('auth').token
      if (token) headers.Authorization = 'Bearer ' + token
      const response = await fetch(API_BASE + path, { ...options, headers })
      if (response.status === 401) Alpine.store('auth').clear()
      return response
    }
  </script>
</head>
<body>
  <p x-data>
    <span x-show="$store.auth.user" x-text="$store.auth.user ? $store.auth.user.nickname : ''"></span>
    <span x-show="!$store.auth.user">로그인 전</span>
  </p>
  <form x-data="loginForm" @submit.prevent="login()" x-show="!$store.auth.user">
    <input type="email" x-model.trim="email" autocomplete="username">
    <input type="password" x-model="password" autocomplete="current-password">
    <button type="submit">로그인</button>
    <p x-text="message"></p>
  </form>
  <div x-data>
    <template x-if="$store.auth.user">
      <p x-text="'user id ' + $store.auth.user.id"></p>
    </template>
  </div>
</body>
</html>
```

회원가입은 같은 폼에서 경로만 `/api/auth/signup`으로 바꾸고 본문에 `nickname`을 더한다. 성공 코드는 `201`이다. 작성자 버튼은 `post.author.id === $store.auth.user.id`일 때 `x-if`로 그린다.

### 줄별 설명

1. `auth` 스토어의 `user`는 공개 프로필, `token`은 메모리의 액세스 토큰이다.
2. `setSession`은 로그인 응답의 `data.user`와 `data.accessToken`만 받는다. 다른 필드는 무시한다.
3. `clear`는 `401`과 로그아웃에서 같이 쓴다.
4. `login`은 비밀번호를 응답 처리 직후 빈 문자열로 지운다. 실패해도 남기지 않는다.
5. 실패 문장은 서버 `error.message` 하나다. "비밀번호가 틀렸다"처럼 원인을 쪼개지 않는다.
6. `api()`는 토큰이 있을 때만 `Authorization: Bearer`를 붙인다.
7. `401`이면 스토어를 비워 화면이 "로그인 전"으로 돌아간다.
8. 닉네임은 `x-text`라서 HTML로 해석되지 않는다.
9. 비밀번호 입력은 `type="password"`와 `autocomplete`만 지정한다.

## ④ 🔗 연동 포인트

프론트와 백엔드가 로그인 상태를 공유하는 방법은 두 가지다. 같은 사이트는 `httpOnly` 쿠키로 `POST /api/auth/login`을 끝내고, Alpine은 토큰을 저장하지 않은 채 `credentials: 'include'`로 `GET /api/auth/me`를 호출해 `user`만 스토어에 채운다. 원점이 나뉘면 로그인 응답의 `accessToken`을 `Alpine.store('auth').token`에만 두고 이후 `api()`가 헤더로 싣는다. 새로고침하면 메모리 토큰은 사라지므로 다시 로그인한다. 쿠키 방식은 `me`가 새로고침 뒤에도 사용자를 복원한다. study6의 쓰기 요청은 이 `api()`를 통과해야 `401`/`403`이 한곳에서 처리된다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 로그인 직후 새로고침하면 풀림 | Bearer 토큰을 메모리에만 둠 | 새로고침 유지가 필요하면 httpOnly 쿠키와 `/api/auth/me`를 쓴다. `localStorage`로 우회하지 않는다 |
| 쿠키를 썼는데 로그인 요청만 실패 | `credentials` 누락 또는 CORS `*` | `credentials: 'include'`와 서버의 명시적 `CORS_ORIGIN`을 맞춘다 |
| 남의 글도 수정 버튼이 보임 | `author.id` 비교를 안 함 | 버튼은 `x-if`로 감춘다. 서버 `403` 처리도 남긴다 |
| 닉네임에 심은 태그가 실행됨 | `x-html`로 닉네임을 출력 | `x-text`를 쓴다 |
| 콘솔에 액세스 토큰이 찍힘 | 디버그 `console.log(body)` | 로그에는 `user.id`만 남긴다 |
| 비밀번호를 해시했다고 표시 | 브라우저에서 자체 해시 후 그 값을 비밀번호 필드에 저장 | 원문을 HTTPS로 서버에만 보내고 입력칸을 비운다 |

## ⑥ 직접 해보기

1. 로그인 성공 응답을 개발자도구에 잠시 출력하지 않은 채로, Application 패널의 Local Storage에 `accessToken` 키가 생기지 않는지 확인한다.
2. `author.id`가 다른 글 객체로 수정 버튼 `x-if`가 거짓이 되는지 임시 데이터로 본다.
3. 닉네임 자리에 `<img src=x onerror=alert(1)>` 형태의 문자를 `x-text`가 글자로만 보여 주는지 확인한다. 이 문자열을 `x-html`에 넣지 않는다.

## ⑦ ☐ 체크리스트

- [ ] `Alpine.store` 로 전역 상태(로그인 사용자)
- [ ] 회원가입 `201`, 로그인 `200`, 실패 `401`, 중복 이메일 `409`를 구분한다
- [ ] 비밀번호는 서버로만 보내고 스토어·`localStorage`에 원문이나 해시를 두지 않는다
- [ ] Bearer는 메모리, 쿠키는 `httpOnly` 전제이며 둘 다 로그에 남기지 않는다
- [ ] 작성자 id가 같을 때만 수정·삭제를 그리고 `403`은 메시지로 받는다
- [ ] `CORS_ORIGIN`은 서버 설정이고 Alpine이 `*`로 풀지 않는다
- [ ] 사용자 문자열은 `x-text`만 사용한다
- [ ] 쿠키 인증이면 상태 변경에 CSRF 토큰 헤더가 필요하다

## ⑧ 다음 단계

study8에서 `api()`와 `auth` 스토어를 파일로 나누고, 개발·운영의 `API_BASE`만 갈아끼우게 정리한다.
