# study10. 배포·정리

## ① 목표

Alpine 정적 페이지를 빌드 없이 또는 파일 복사로 배포하고, 도메인·HTTPS·운영 환경 변수·배포 뒤 확인까지 기초 구간을 닫는다.

## ② 📖 이론

### 왜 쓰는지

CDN으로 Alpine을 읽는 페이지는 컴파일 산출물이 없다. 배포물의 본체는 `index.html`, `css`, `js`다. 그래도 운영은 개발 PC의 `127.0.0.1`과 다르다. 주소가 `https://앱도메인`이 되고, API는 다른 호스트일 수 있으며, `config.js`는 그 호스트에 맞게 서버 안에서 만들어져야 한다.

### 핵심 개념

- **빌드**: CDN 방식은 `npm run build`가 없어도 된다. 배포 명령은 필요한 파일만 복사하는 일이다. 모듈 번들을 선택했을 때만 번들러의 산출물 폴더를 올린다. 두 방식을 한 사이트에 섞지 않는다.
- **도메인**: 사람이 여는 이름이다. DNS가 그 이름을 서버 IP로 연결한다. Alpine 코드는 도메인 문자열을 여러 파일에 적지 않고 `location.origin`과 `API_BASE`만 안다.
- **HTTPS**: 인증서가 전송을 암호화한다. 로그인과 비밀번호는 HTTPS가 아닌 운영 주소로 보내지 않는다. 로컬 개발의 `http://127.0.0.1`은 예외로 두고 그 예외를 운영 설정에 복사하지 않는다.
- **환경 변수**: 호스트의 `API_BASE`로 `js/config.js`를 생성한다. DB 접속 문자열은 정적 파일 호스트에 두지 않는다. DB는 API 서버의 환경 변수이고, Alpine 배포물에는 그 서버의 공개 HTTPS 원점만 있다.
- **캐시**: HTML은 짧게, `cdn.min.js`는 버전이 주소에 있으므로 오래 캐시돼도 3.17.5가 유지된다. 직접 작성한 `js/api.js`를 고치면 파일 내용을 바꿨는지 새로고침으로 확인한다.

### 비유

배포는 같은 메뉴판을 다른 매장에 붙이는 일이다. 매장 문패(도메인)와 금고 위치(API 원점)만 바꾸고, 레시피 원본의 비밀 양념 비율(DB 비밀번호)은 메뉴판에 인쇄하지 않는다.

### 기초 구간 총정리

| 단계 | 남기는 것 |
| --- | --- |
| study0 | 3.17.5, `defer`, Git, `.env`는 공개 원점만 |
| study1 | `x-data` `x-text` `x-show` `@click` `x-model` |
| study2 | `x-for` `x-if`, 모달·드롭다운·탭, `$dispatch` |
| study3 | 로컬 상태, 스토어, 초안 `localStorage` |
| study4 | 해시 목록·상세·오류, `q` `page` |
| study5 | 검증, 중복 제출 방지, 200·201·400·422 |
| study6 | `x-init` + `fetch`, 스펙 v1 CRUD, `config.js` |
| study7 | `Alpine.store('auth')`, Bearer 또는 쿠키, XSS·CSRF·CORS |
| study8 | `pure.js` `api.js` `stores.js` 분리, 환경별 설정 |
| study9 | `node --test`, 가짜 `fetch`, 오류 10가지 |

## ③ 🛠️ 실기

배포에 포함할 파일만 고른다.

```text
index.html
css/app.css
js/config.js      배포 직전 생성
js/pure.js
js/api.js
js/stores.js
js/components.js
```

포함하지 않는다: `.env`, `js/pure.test.mjs`, `node_modules`.

생성 예:

```powershell
"window.__CONFIG = { apiBase: '$env:API_BASE' };" | Set-Content js/config.js -Encoding utf8
```

`API_BASE`가 `https://`로 시작하지 않으면 생성 후 배포를 중단한다. 값에 따옴표가 있으면 생성하지 않는다.

정적 서버에 폴더를 올린 뒤 브라우저에서 확인한다.

```text
https://앱도메인/            HTML 200, Alpine.version === 3.17.5
https://앱도메인/js/config.js    apiBase가 운영 HTTPS 원점
개발자도구 Network            GET /api/posts 가 그 원점으로 나감
```

### 줄별 설명

1. 배포 목록은 브라우저가 실행할 파일만 있다.
2. `config.js`는 저장소의 파일이 아니라 배포 단계의 출력이다.
3. PowerShell 한 줄은 환경 변수를 JS 문자열로 만든다. 값이 비어 있으면 `apiBase`가 빈 문자열이 되므로 그 경우 업로드하지 않는다.
4. HTTPS 접두어 검사는 운영에서 `http://127.0.0.1`이 나가는 실수를 막는다.
5. 첫 화면 확인은 버전, 설정 파일, 목록 요청의 호스트 세 가지다.

### 배포 후 점검표

- [ ] `https://앱도메인`이 인증서 오류 없이 열린다
- [ ] 콘솔 `Alpine.version`이 `3.17.5`다
- [ ] `js/config.js`의 `apiBase`가 운영 API의 `https` 원점이다
- [ ] `GET /api/posts?page=1&limit=10&sort=-createdAt`가 200이고 `data`·`meta`가 있다
- [ ] `GET /health`가 `{ "status": "ok" }`다
- [ ] 로그인 요청이 HTTPS다
- [ ] Local Storage에 토큰·비밀번호·API 키가 없다
- [ ] 없는 경로 `#/nope`에 오류 화면이 있다
- [ ] 배포 폴더에 `.env`가 없다

## ④ 🔗 연동 포인트

운영 호스트의 환경 변수 `API_BASE`만 Alpine과 연결된다. DB 호스트, DB 이름, DB 사용자는 API 서버의 환경 변수로 남고 정적 배포물의 점검표에 "Alpine이 DB 주소를 모른다"를 넣는다. API 서버를 재시작해도 `config.js`의 원점이 같으면 화면 파일을 다시 올리지 않는다. 원점이 바뀌면 `config.js`만 다시 생성한다. 사용자 브라우저의 해시 경로 `#/posts/1`은 서버 재시작과 무관하다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 운영에서 Alpine 미실행 | CDN을 막는 네트워크 정책 | 같은 버전의 `cdn.min.js`를 자체 정적 경로로 호스팅하고 주소를 고정한다 |
| 혼합 콘텐츠 경고 | HTTPS 페이지가 `http://` API를 호출 | `API_BASE`를 `https://`로 다시 생성한다 |
| 배포 폴더에 테스트 파일 | 폴더 전체 복사 | 허용 목록만 복사한다 |
| 인증서 이름 불일치 | DNS와 인증서의 도메인이 다름 | 사람이 여는 도메인과 인증서 이름을 맞춘다. Alpine 코드 문제가 아니다 |
| 옛 `api.js`가 남음 | 브라우저 또는 CDN 캐시 | HTML은 `cache`를 짧게 하고 파일 변경 후 강력 새로고침으로 확인한다 |
| 점검 중 500의 스택이 화면에 보임 | 서버가 예외 원문을 JSON에 넣음 | 화면은 `error.message`만 보여 주고 스택이 오면 서버 설정을 고친다 |

## ⑥ 직접 해보기

1. `API_BASE`를 비운 채 생성한 `config.js`를 열어 업로드하면 안 되는 내용인지 판단하고 파일을 지운다.
2. 로컬 `npx serve`로 배포 목록과 같은 파일만 남긴 폴더를 띄워 `#/posts`와 `#/nope`을 확인한다.
3. Network 패널에서 Alpine CDN 주소가 `alpinejs@3.17.5`인지 한 번 더 본다.

## ⑦ ☐ 체크리스트

- [ ] 배포물에 `.env`, 테스트, `node_modules`가 없다
- [ ] 운영 `config.js`는 HTTPS `API_BASE`로 생성된다
- [ ] 도메인과 인증서 이름을 점검표에 적었다
- [ ] 목록·헬스·없는 해시·로그인 요청을 배포 후 확인했다
- [ ] DB 접속 정보는 API 서버에만 있다
- [ ] 기초 10단계 표의 디렉티브와 스펙 필드가 배포 페이지에 남아 있다

## ⑧ 다음 단계

studymidpoint에서 study0부터 study10까지의 조각만 모아, 로그인과 CRUD가 있는 작은 게시판 서비스 문서로 잇는다.
