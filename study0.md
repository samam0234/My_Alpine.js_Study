# study0. 환경 설정

## ① 목표

Alpine.js 3.17.5를 고정 버전으로 넣고, 정적 폴더·개발 서버·Git·공개 환경 변수 파일을 갖춘다.

## ② 📖 이론

### 왜 쓰는지

Alpine은 HTML 속성에 상태를 적으면 그 상태가 바뀔 때 같은 요소의 글자, 표시, 입력을 다시 맞춘다. 첫 단계의 목적은 화면 기능이 아니라, 나중에 모든 예제가 같은 버전·같은 주소·같은 무시 목록 위에서 돌아가게 하는 것이다. 버전을 `3.x.x`처럼 떠 있는 범위로 두면 내일의 예제가 오늘의 설명과 달라질 수 있다.

### 핵심 개념

- **CDN 빌드**: `cdn.min.js`를 `defer`로 읽으면 DOM이 준비된 뒤 Alpine이 스스로 `Alpine.start()`를 호출한다.
- **모듈 빌드**: `npm install alpinejs@3.17.5` 후 `import Alpine from 'alpinejs'`를 쓰고, 플러그인 등록과 `Alpine.start()`를 직접 한 번만 한다.
- **디렉티브**: `x-`로 시작하는 HTML 속성. 동작의 이름이다.
- **스코프**: `x-data`가 만든 데이터 상자. 그 요소 안의 표현식은 이 상자를 본다.
- **매직**: `$store`, `$refs`, `$watch`처럼 Alpine이 넣어 주는 이름.
- **공개 설정과 비밀**: 브라우저가 알아야 하는 `API_BASE`만 프론트 설정이다. DB 비밀번호와 API 키는 Alpine 파일에 두지 않는다.

### 비유

Alpine 한 줄은 이미 차려진 식탁(HTML) 위에 올리는 양념통이다. 주방을 새로 짓는 빌드 단계가 필수는 아니다. 통의 제조일자(3.17.5)를 라벨에 적고, 레시피 비밀(키)은 식당 바깥 금고에 둔다.

## ③ 🛠️ 실기

PowerShell에서 프로젝트 루트로 이동한 뒤 폴더와 파일을 만든다.

```powershell
mkdir css, js -Force
npm view alpinejs version
git init
```

`npm view alpinejs version`의 결과가 `3.17.5`인지 확인한다. 다르면 아래 주소의 패치 번호만 문서와 같이 올린다. 학습 문서는 2026-11-20 기준 [v3.17.5](https://github.com/alpinejs/alpine/releases/tag/v3.17.5)에 고정한다.

`.gitignore`

```gitignore
.env
js/config.js
node_modules/
dist/
.DS_Store
Thumbs.db
```

`.env.example`

```bash
# 브라우저에 공개돼도 되는 값만 둔다.
API_BASE=http://127.0.0.1:8080
```

`.env`는 `.env.example`을 복사해 만든다. `.env`는 Git에 올리지 않는다.

```powershell
Copy-Item .env.example .env
```

`index.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Alpine 환경 확인</title>
  <link rel="stylesheet" href="./css/app.css">
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
</head>
<body>
  <p x-data x-text="'Alpine ' + Alpine.version"></p>
</body>
</html>
```

`css/app.css`

```css
body { font-family: sans-serif; margin: 2rem; }
```

개발 서버:

```powershell
npx --yes serve . -l 5500
```

브라우저에서 `http://127.0.0.1:5500`을 연다. 화면에 `Alpine 3.17.5`가 보여야 한다. 개발자도구 콘솔에서 `Alpine.version`을 다시 입력해 같은 문자열인지 본다.

에디터는 Cursor 또는 VS Code를 쓴다. 확장 프로그램 검색에서 다음을 설치한다.

- Alpine.js IntelliSense (`adrianwilczynski.alpine-js-intellisense`): `x-data`, `@click` 자동 완성
- Live Server (`ritwickdey.LiveServer`): 저장할 때 브라우저를 새로고침하고 싶을 때의 대안 서버

모듈 빌드를 나중에 쓸 때만 다음을 실행한다. CDN 예제에는 필요 없다.

```powershell
npm install alpinejs@3.17.5
```

### 줄별 설명

`index.html`

1. 문서 형식 선언.
2. 한국어 문서.
3. `head` 시작.
4. 한글이 깨지지 않도록 UTF-8.
5. 탭 제목.
6. 빈 스타일 파일과 연결. 경로가 상대 경로라 서버 루트가 프로젝트 루트여야 한다.
7. Alpine 3.17.5 CDN. `defer`가 있어야 HTML을 다 읽은 뒤 실행한다.
8. `head` 끝.
9. `body` 시작.
10. 빈 `x-data`는 그 문단을 Alpine 스코프로 만든다. `x-text`는 요소의 글자를 표현식 결과로 바꾼다. `Alpine.version`은 런타임 버전 문자열이다.
11. `body` 끝.
12. 문서 끝.

## ④ 🔗 연동 포인트

이 폴더가 이후 모든 단계의 정적 루트다. Git 저장소를 여기서 초기화하고 `.gitignore`로 `.env`, 생성될 `js/config.js`, `node_modules`, `dist`를 제외한다. `.env`의 `API_BASE`는 study6부터 `js/config.js`의 `window.__CONFIG.apiBase`로만 옮긴다. 그 파일도 Git에서 빠진다. 배포 서버의 환경 변수는 study10과 study16에서 같은 키 이름을 다시 쓴다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 화면에 표현식 글자가 그대로 있다 | `defer`가 없거나 스크립트 주소가 404 | 네트워크 탭에서 `cdn.min.js`가 200인지 확인하고 `defer`를 붙인다 |
| `Alpine is not defined` | 콘솔을 스크립트보다 먼저 열었거나 CDN이 막힘 | 페이지를 새로고침한 뒤 콘솔에서 `Alpine.version`을 친다 |
| `npm`을 찾을 수 없다 | Node.js가 PATH에 없음 | Node.js LTS를 설치하고 터미널을 다시 연다. CDN 학습은 npm 없이도 된다 |
| Live Server 포트가 이미 사용 중 | 5500을 다른 프로세스가 점유 | `npx serve . -l 5501`처럼 빈 포트를 지정한다 |
| `git add .` 뒤에 `.env`가 스테이징됨 | `.gitignore`보다 먼저 추적됨 | `git rm --cached .env` 후 무시 목록을 확인한다. 이미 푸시한 비밀은 폐기하고 재발급한다 |
| CSS가 안 먹음 | `file://`로 HTML을 더블 클릭 | `http://127.0.0.1:5500`으로 연다 |

## ⑥ 직접 해보기

1. CDN 주소의 패치 번호를 `3.17.4`로 잠깐 바꿔 화면에 그 버전이 찍히는지 본 뒤, 다시 `3.17.5`로 되돌린다.
2. `.env`에 `DB_PASSWORD=nope`를 넣고 `git status`에 `.env`가 보이지 않는지 확인한 다음 그 줄을 지운다. DB 비밀번호는 이 파일의 학습 항목이 아니다.
3. 확장 프로그램이 켜진 에디터에서 `x-`를 입력해 디렉티브 후보가 나오는지 본다.

## ⑦ ☐ 체크리스트

- [ ] `alpinejs@3.17.5` CDN 주소와 `defer`를 확인했다
- [ ] 브라우저 콘솔의 `Alpine.version`이 `3.17.5`다
- [ ] `index.html`, `css/app.css`, `js/` 폴더가 있다
- [ ] `npx serve` 또는 Live Server로 `http://127.0.0.1` 포트를 열었다
- [ ] Alpine.js IntelliSense를 설치했다
- [ ] `git init`을 했고 `.gitignore`에 `.env`, `js/config.js`, `node_modules/`, `dist/`가 있다
- [ ] `.env.example`를 복사해 `.env`를 만들었고 Git 상태에 `.env`가 없다
- [ ] 비밀 키를 프론트 환경 변수에 넣지 않았다

## ⑧ 다음 단계

study1에서 같은 `index.html`에 인사 문장, 보이기 토글, 클릭, 입력 바인딩을 올려 첫 상호작용을 만든다.
