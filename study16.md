# study16. 운영·CI/CD

## ① 목표

Alpine 정적 사이트를 컨테이너로 감싸고, 푸시할 때 배포 워크플로가 돌 항목과 로그·백업 점검을 목록으로 고정한다.

## ② 📖 이론

### 왜 쓰는지

study10은 파일을 어디에 올릴지 정했다. 운영은 그 복사를 같은 순서로 반복하고, 실패한 배포를 사람이 알아볼 수 있게 하는 일이다. Alpine 프로세스에는 요청 로그가 없다. 로그는 정적 파일을 전달하는 웹 서버와 API 서버에 남고, 브라우저 문제는 `requestId`로 API 로그와만 연결된다.

### 핵심 개념

- **이미지**: nginx가 `index.html`과 `js`를 제공한다. Alpine을 서버에서 실행하지 않는다.
- **워크플로**: GitHub Actions가 테스트 후 정적 파일을 올린다. 비밀은 저장소 시크릿이며 YAML에 적지 않는다. `API_BASE`는 공개 원점이라 변수로 두되 DB 비밀번호 자리는 만들지 않는다.
- **로그**: nginx 접속 로그와 브라우저 콘솔. API 애플리케이션 로그는 API 서버의 몫이다.
- **모니터링**: 배포 직후 `/`와 `/js/config.js`, API `GET /health`의 상태 코드.
- **백업**: 정적 사이트의 원본은 Git이다. 사용자의 글 백업은 API의 DB 백업이며 Alpine 배포 산출물에 덤프를 넣지 않는다.

### 비유

컨테이너는 같은 액자를 매장마다 거는 포장이고, 워크플로는 포장 순서가 적힌 체크표다. 고객 장부(DB)는 액자 뒤에 넣지 않는다.

## ③ 🛠️ 실기

`Dockerfile`

```dockerfile
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
```

`js/config.js`는 이미지에 복사하기 전에 공개 `API_BASE`로 생성한다. `.dockerignore`에 `.env`, `js/*.test.mjs`, `.git`을 넣는다.

`nginx.conf`의 서버는 80에서 정적 파일만 준다. `try_files`로 없는 파일을 `index.html`에 넘길 필요는 해시 라우터에는 없다. 없는 `/js/api.js`는 404가 맞게 한다.

`.github/workflows/pages.yml`

```yaml
name: check
on:
  push:
    branches: [master]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: node --test js/pure.test.mjs
```

배포 잡이 필요하면 테스트 잡이 성공한 뒤에만 정적 파일을 올린다. 시크릿을 `echo`하지 않는다.

### 줄별 설명

1. 베이스 이미지는 nginx다. Node로 Alpine을 상시 실행하지 않는다.
2. `COPY` 목록은 study10의 허용 파일과 같다.
3. 워크플로의 첫 자동 관문은 `node --test`다.
4. `setup-node`는 테스트를 위한 것이고 브라우저 런타임을 이미지에 넣기 위한 것이 아니다.
5. 브랜치가 `master`가 아니면 이 파일이 동작하지 않는다. 기본 브랜치 이름과 맞춘다.

### 점검표

배포 전

- [ ] `node --test js/pure.test.mjs` 통과
- [ ] `config.js`의 `apiBase`가 `https://`이고 따옴표가 없다
- [ ] 이미지 빌드 컨텍스트에 `.env`가 없다
- [ ] CDN 또는 자체 호스트 스크립트가 `3.17.5`다
- [ ] 워크플로 YAML에 키 문자열이 없다

배포 직후

- [ ] 사이트 `/`가 200이다
- [ ] `Alpine.version`이 `3.17.5`다
- [ ] `GET /health`가 200 `{ "status": "ok" }`다
- [ ] 목록 `GET /api/posts`가 운영 원점으로 나간다
- [ ] 로그인 폼이 HTTPS 페이지에 있다

로그·모니터링

- [ ] nginx 접속 로그에 쿼리의 비밀번호가 없다. 로그인 본문은 정적 서버 로그에 남지 않아야 한다
- [ ] 브라우저에서 실패한 API의 `X-Request-Id`를 API 로그에서 찾을 수 있다
- [ ] 4xx와 5xx 비율을 볼 자리가 있다. 없으면 배포 직후 수동으로 목록·없는 id·빈 폼을 한 번씩 호출한다
- [ ] 인증서 만료일을 확인했다

백업

- [ ] 정적 파일은 Git 커밋으로 되돌릴 수 있다
- [ ] DB 덤프 절차는 API 서버 문서에만 있고 이 저장소에 덤프 파일이 없다
- [ ] `localStorage` 초안은 백업 대상이 아니다

## ④ 🔗 연동 포인트

워크플로가 `API_BASE`로 `config.js`를 만든 뒤 이미지에 넣으면 study8의 개발·운영 분리가 자동이 된다. 컨테이너의 환경 변수로 브라우저가 `API_BASE`를 읽게 하려면 시작 스크립트가 `config.js`를 다시 써야 한다. 런타임에 Alpine이 `process.env`를 읽지는 못한다. DB 컨테이너가 따로 있다면 그 네트워크 이름과 비밀번호는 API 서비스 환경 변수에만 둔다. Alpine nginx 서비스에는 `depends_on`으로 DB를 걸지 않아도 된다. 헬스 확인은 API의 `/health`를 배포 잡의 다음 단계에서 호출한다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 컨테이너에서 `config.js` 404 | `COPY js` 전에 생성하지 않음 | 빌드 전에 공개 원점으로 파일을 만든다 |
| 이미지에 `.env`가 있음 | dockerignore 누락 | `.dockerignore`를 확인하고 이미지를 다시 만든다. 이미 푸시한 비밀은 폐기한다 |
| Actions가 테스트를 못 찾음 | 작업 디렉터리 오타 | 저장소 루트의 `js/pure.test.mjs` |
| 모든 경로가 index.html | `try_files`가 과함 | 없는 정적 파일은 404로 둔다. 화면 경로는 해시가 담당한다 |
| 로그에 `Authorization` | 디버그 로그 형식 | 헤더를 접속 로그 형식에서 뺀다 |
| 백업 zip에 `node_modules` | 폴더 전체 압축 | Git 태그로 소스만 표시한다 |

## ⑥ 직접 해보기

1. `.dockerignore` 없이 빌드하지 말고, 무시 목록을 먼저 적은 뒤 `docker build` 로그의 전송 파일에 `.env`가 없는지 본다.
2. 워크플로 파일에서 `node --test` 한 줄이 로컬 명령과 같은지 비교한다.
3. 없는 `/js/없는파일.js`가 404인지, `#/없는경로`는 `index.html` 위의 오류 화면인지 구분한다.

## ⑦ ☐ 체크리스트

- [ ] Dockerfile은 nginx 정적 파일이고 Alpine 서버 런타임이 아니다
- [ ] 테스트가 없는 배포 잡이 먼저 성공하지 않는다
- [ ] 비밀이 YAML과 이미지에 없다
- [ ] 배포 직후 버전·헬스·목록을 확인한다
- [ ] `requestId`로 API 로그를 찾는다
- [ ] DB 백업 파일이 이 저장소에 없다
- [ ] 롤백은 Git 커밋 단위다

## ⑧ 다음 단계

study17에서 이미 배포된 페이지에 웹소켓 알림과 브라우저 안 파일 읽기를 덧붙인다.
