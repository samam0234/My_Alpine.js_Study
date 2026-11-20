# study8. 구조화·재사용

## ① 목표

한 파일에 모여 있던 스토어·API·화면을 폴더로 나누고, 개발과 운영이 다른 공개 설정만 바라보게 한다.

## ② 📖 이론

### 왜 쓰는지

study6과 study7의 예제는 한 HTML에서 읽히게 하려고 함수를 페이지 안에 넣었다. 기능이 늘면 같은 `fetch` 래퍼를 화면마다 복사하게 된다. 복사는 오류 형식이나 헤더를 한곳만 고치는 일을 망가뜨린다. Alpine 앱의 구조화는 프레임워크의 의존성 주입이 아니라, 역할이 다른 스크립트를 나누고 `alpine:init` 한곳에서 등록하는 일이다.

### 핵심 개념

```text
index.html
css/app.css
js/config.js          공개 API_BASE만. Git 제외
js/config.example.js  예시. Git 포함
js/api.js             fetch 래퍼
js/stores.js          Alpine.store 등록
js/components.js      Alpine.data 등록
js/boot.js            위 파일들을 쓰는 진입점
.env.example
.gitignore
```

- **공통 모듈**: `api.js`만 상태 코드를 해석한다. 컴포넌트는 `ApiError`의 `status`와 `error.fields`를 받는다.
- **유틸**: `parseHash`, `validatePost`처럼 DOM을 모르는 함수는 `js/pure.js`에 둔다. study9가 이 파일을 테스트한다.
- **설정**: 개발 `API_BASE=http://127.0.0.1:8080`, 운영 `API_BASE=https://api.example.com`. 키 이름은 같다. 바꾸는 것은 배포 환경이 `js/config.js`를 만드는 방식이다.
- **중복 제거**: 목록 화면과 상세 화면이 각자 `fetch`를 호출하지 않고 `api('/api/posts...')`만 호출한다.
- **스크립트 순서**: `config.js` → `pure.js` → `api.js` → `stores.js` → `components.js` → Alpine CDN. 등록 코드는 모두 `alpine:init` 안에 둔다. `Alpine.start()`는 CDN이 한 번 호출하므로 다시 호출하지 않는다.
- **모듈 빌드를 쓸 때**: `import Alpine from 'alpinejs'` 다음, 플러그인 등록 다음, `Alpine.start()` 한 번. CDN과 모듈 빌드를 같은 페이지에 같이 넣지 않는다.

### 비유

`config.js`는 출입구에 붙이는 오늘자 창구 번호다. 개발 매장과 운영 매장의 번호만 다르고, 주문 양식(`api.js`)은 같은 인쇄물이다.

## ③ 🛠️ 실기

`js/config.example.js`

```javascript
window.__CONFIG = { apiBase: 'http://127.0.0.1:8080' }
```

`js/pure.js`

```javascript
function validatePost(form) {
  const fields = {}
  const title = (form.title || '').trim()
  const body = (form.body || '').trim()
  if (title.length < 1 || title.length > 200) fields.title = ['1~200자로 입력하세요.']
  if (body.length < 1) fields.body = ['본문을 입력하세요.']
  return fields
}
```

`js/api.js`

```javascript
function apiBase() {
  return String(window.__CONFIG?.apiBase || '').replace(/\/$/, '')
}

async function api(path, options = {}) {
  const headers = { 'Accept': 'application/json', ...(options.headers || {}) }
  if (options.body) headers['Content-Type'] = 'application/json; charset=utf-8'
  const token = window.Alpine?.store('auth')?.token
  if (token) headers.Authorization = 'Bearer ' + token
  const response = await fetch(apiBase() + path, { ...options, headers })
  if (response.status === 204) return { status: 204, data: null }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error?.message || '요청을 처리하지 못했습니다.')
    error.status = response.status
    error.info = body.error || { code: 'INTERNAL', message: error.message }
    throw error
  }
  return { status: response.status, data: body.data, meta: body.meta }
}
```

`js/stores.js`

```javascript
document.addEventListener('alpine:init', () => {
  Alpine.store('auth', {
    user: null,
    token: '',
    setSession(data) { this.user = data.user; this.token = data.accessToken || '' },
    clear() { this.user = null; this.token = '' }
  })
})
```

`index.html`의 `head` 끝부분만 적으면 다음과 같다.

```html
<script src="./js/config.js"></script>
<script src="./js/pure.js"></script>
<script src="./js/api.js"></script>
<script src="./js/stores.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
```

개발 설정은 `Copy-Item js/config.example.js js/config.js`다. 운영 서버는 배포 스크립트가 같은 파일 자리에 운영 원점을 넣어 만든다. HTML은 두 환경을 분기하는 if를 갖지 않는다.

### 줄별 설명

1. `config.example.js`는 공개 원점의 견본이다. 비밀 키가 없다.
2. `validatePost`는 DOM과 Alpine을 모른다. 입력 객체만 받는다.
3. `apiBase`는 끝의 `/`를 제거해 `//api`가 되지 않게 한다.
4. 본문이 있을 때만 `Content-Type`을 붙인다. `DELETE`처럼 본문이 없는 요청에 JSON 타입을 억지로 넣지 않아도 된다.
5. 토큰은 `auth` 스토어가 생긴 뒤에만 읽는다. 스토어가 없으면 헤더를 생략한다.
6. 실패는 예외로 올려 화면마다 `response.ok`를 반복하지 않게 한다.
7. `stores.js`의 등록은 `alpine:init` 한 번이다.
8. `config.js`를 Alpine보다 먼저 두면 `x-init`의 첫 `fetch`가 빈 원점으로 나가지 않는다.

## ④ 🔗 연동 포인트

개발 PC의 `.env`와 운영 호스트의 환경 변수는 둘 다 `API_BASE`라는 이름만 공유한다. 정적 호스팅은 프로세스 환경 변수를 브라우저가 읽지 못하므로, 배포 단계에서 `js/config.js`를 생성한다. 생성 규칙은 "값이 `http://` 또는 `https://`로 시작하는 원점 하나"다. `API_KEY`, `DATABASE_URL` 같은 이름이 생성기에 들어오면 파일을 만들지 않고 배포를 실패시킨다. study10의 빌드 산출물도 이 `config.js`를 환경별로 따로 넣는다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `api is not defined` | 스크립트 순서가 Alpine 평가보다 늦음 | `defer`가 없는 일반 스크립트로 `api.js`를 `head`에서 먼저 읽는다 |
| `Alpine is not defined` in `stores.js` | `alpine:init` 없이 즉시 `Alpine.store` 호출 | 이벤트 안으로 옮긴다 |
| 컴포넌트가 두 번 동작 | CDN과 `Alpine.start()`를 같이 사용 | 시작 호출은 한 방식만 남긴다 |
| 운영에서 개발 API를 호출 | `config.js`를 저장소에 커밋해 배포에 포함 | `config.js`는 무시하고 배포 스크립트가 만든다 |
| 유틸을 고쳤는데 화면이 그대로 | 브라우저가 옛 `pure.js`를 캐시 | 개발 중에는 새로고침을 강제하고, 배포 때는 파일 이름에 해시를 붙이는 빌드를 고려한다 |
| 화면 파일마다 다른 오류 문장 | `fetch` 복붙 | 오류 해석은 `api.js` 한 파일로 모은다 |

## ⑥ 직접 해보기

1. `validatePost`를 화면 파일에서 지우고 `pure.js`만 남긴 뒤, 빈 제목이 여전히 막히는지 본다.
2. `config.js`의 원점 끝에 `/`를 붙여 `apiBase()` 결과가 슬래시로 끝나지 않는지 콘솔에서 확인한다.
3. `stores.js`를 Alpine 스크립트보다 아래로 옮겨 `alpine:init`이 이벤트를 놓치지 않는지, 놓친다면 순서를 되돌린다.

## ⑦ ☐ 체크리스트

- [ ] `config.js`, `pure.js`, `api.js`, `stores.js`가 역할별로 나뉘어 있다
- [ ] 화면 컴포넌트에 `fetch` 문자열이 남아 있지 않다
- [ ] 개발과 운영은 `API_BASE` 값만 다르고 HTML 분기가 없다
- [ ] `config.js`와 `.env`가 `.gitignore`에 있다
- [ ] 비밀 환경 변수는 `config.js` 생성기에서 거부된다
- [ ] `Alpine.start()`와 CDN 자동 시작을 같이 쓰지 않는다

## ⑧ 다음 단계

study9에서 `pure.js`를 단위 테스트하고, `api.js`의 `fetch`를 가짜 응답으로 바꿔 상태 코드별 분기를 확인한다.
