# studyfinal. Alpine 하나로 서비스 마무리

## ① 목표

studymidpoint의 게시판에 study11~18의 저장 경계, 외부 요청, 발췌 질문, 정적 배포를 더해 Alpine.js 3.17.5만으로 서비스 구성을 닫는다.

## ② 📖 이론

### 왜 쓰는지

심화 예제를 따로 두면 목록 캐시가 삭제를 무시하거나, 결제 주소 검사가 작성 화면의 `busy`와 어긋난다. 최종 문서는 같은 `api()`, 같은 `auth` 스토어, 같은 해시 라우터가 모든 기능을 통과하게 순서를 고정한다.

### 핵심 개념

화면 런타임은 브라우저의 Alpine이다. DB, 메일 서버, 결제 서버, 모델 키, MCP 프로세스는 화면 저장소 밖에 있다. 화면이 아는 외부 정보는 공개 `API_BASE`와 `wss` 원점뿐이다.

### 비유

홀의 주문판(Alpine)은 하나다. 주방 냉장고를 바꾸거나 계산대를 다른 건물로 옮겨도, 주문판의 칸 이름(`data`, `error`, `auth`)이 같으면 홀 직원은 같은 판을 쓴다.

## 기능 목록

- studymidpoint의 로그인, 목록, 상세, 작성, 수정, 삭제, 댓글, 오류 화면
- `http` 어댑터 기본, 테스트에서만 `memory` (study11)
- collapse·focus·persist 테마 (study12)
- 1MB 이하 텍스트 미리보기, 업로드, 메일 요청, HTTPS 결제 이동, OAuth 복귀 (study13, study17)
- `postListPath`와 오류 형식 (study14)
- 검색 디바운스, 요청 취소, 30초 캐시, 쓰기 후 캐시 삭제 (study15)
- nginx 이미지와 테스트 워크플로 (study16)
- 공개 글 알림 소켓과 알림 권한 버튼 (study17)
- TXT 발췌 질문, 선택적 SSE, `search_posts`는 `id`·`title`만 (study18)

## 연동 구성도

```text
브라우저 Alpine 3.17.5
  auth 스토어 (메모리 토큰 또는 쿠키 세션의 user)
  config.js API_BASE
  hash  #/posts  #/posts/{id}  #/write  #/ask  #/nope
        | REST 스펙 v1, /api/uploads, /api/checkout, /api/ai/chat/stream
        | wss /ws   { type: post.created }
        v
API (JWT 또는 세션, CORS_ORIGIN, 모델 키, SMTP, 결제 비밀)
        |
        +-- 저장소: MariaDB 또는 PostgreSQL 또는 MongoDB
        |     화면은 id, createdAt, data, meta 만 수신
        +-- 모델 프록시: 같은 /api/ai/chat/stream
        +-- MCP 프로세스는 선택. 도구 이름 search_posts
```

## 구현 순서

1. study8 파일 구조와 study0의 3.17.5 CDN·Git 무시를 다시 적용한다.
2. `api.js`에 `signal`, 204, `error.fields`, Bearer, 401이면 `auth.clear`를 모두 넣는다.
3. 해시 라우터에 `write`와 `ask`를 추가한다.
4. 목록은 `postListPath` + 디바운스 + 캐시다. 생성·수정·삭제 성공 시 캐시를 비운다.
5. 작성자 버튼은 `author.id` 비교와 서버 403을 둘 다 둔다.
6. 업로드와 결제 버튼은 `extras` 컴포넌트다. 결제 URL은 `https://`만 `location.assign` 한다.
7. `#/ask`는 `docAsk`다. `aiStream`이 없으면 발췌 답만 한다.
8. `liveBoard.connect`는 운영에서 `wss`만 연다. 실패하면 목록 버튼이 남는다.
9. `node --test js/pure.test.mjs` 후 Dockerfile 허용 목록만 이미지에 넣는다.
10. study10 점검표에 `/health`, 없는 해시, 발췌 없음 질문, Local Storage에 토큰이 없는지를 더한다.

### 라우터에 질문을 추가하는 코드

```javascript
if (path === '/ask') return { name: 'ask', query }
```

```html
<template x-if="route.name === 'ask'">
  <div x-data="docAsk" x-init="loadPosts()">
    <textarea x-model="documentText"></textarea>
    <input x-model.trim="question">
    <button type="button" @click="ask()" :disabled="busy">질문</button>
    <pre x-text="answer"></pre>
  </div>
</template>
```

### 줄별 설명

1. `parseHash`가 `#/ask`를 새 화면 이름으로 돌려준다. 모르는 경로는 계속 `notfound`다.
2. `docAsk`는 study18 컴포넌트다. 라우터 스코프와 섞이지 않게 안쪽 `x-data`를 둔다.
3. `x-init="loadPosts()"`는 질문 화면에 들어올 때 공개 목록만 받아 도구 연습에 쓴다.
4. 답은 `pre`와 `x-text`다.
5. `busy`는 스트림과 로컬 답변의 중복 클릭을 막는다.

## 배포 체크리스트

- [ ] 테스트 잡이 통과한 뒤에만 이미지를 만든다
- [ ] 이미지에 `.env`, 테스트, 모델 키, DB 덤프가 없다
- [ ] `Alpine.version`이 `3.17.5`다
- [ ] `API_BASE`가 운영 `https://`다
- [ ] `GET /health`와 `GET /api/posts`가 스펙 모양이다
- [ ] 비로그인 쓰기와 AI 스트림은 401이다
- [ ] 발췌가 없으면 `찾을 수 없습니다`다
- [ ] 결제 이동은 `https://`만 허용한다
- [ ] 소켓 URL에 토큰이 없다
- [ ] Local Storage에 액세스 토큰과 비밀번호가 없다
- [ ] `#/nope` 오류 화면이 있다
- [ ] 삭제 후 30초 캐시 때문에 글이 다시 보이지 않는다
- [ ] `X-Request-Id`를 API 로그에서 찾을 수 있다
- [ ] 롤백은 이전 Git 커밋의 정적 파일이다

## 최종 회고

- Alpine은 상태와 화면을 속성으로 묶는다. 서비스가 커져도 그 경계는 `x-data`, 스토어, `api()` 세 곳이다.
- DB를 바꿔도 화면이 안 바뀌는 조건은 ORM 설정이 아니라 `id`와 `createdAt` JSON이다.
- AI 기능의 안전한 기본값은 키 없는 발췌 인용이다. 스트리밍은 같은 원점 프록시가 있을 때만 켠다.
- 실시간은 실패해도 목록 GET이 남으므로 필수 경로가 아니다.
- 하지 않은 일: 다른 UI 프레임워크와의 결합, 브라우저 안의 DB 드라이버, 브라우저 안의 MCP 서버, 비밀 키 배포.

## ③ 🛠️ 실기

구현 순서 4와 7이 최종 화면의 두 축이다. 목록은 studymidpoint의 `postList`에 study15 캐시를 얹고, 질문은 위의 `#/ask` 템플릿을 라우터에 넣는다.

## ④ 🔗 연동 포인트

배포 워크플로는 `API_BASE`로 `config.js`만 바꾼다. DB 교체는 API 서버의 저장 설정이고 이미지의 nginx는 그 이름을 모른다. 모델과 Ollama는 `/api/ai/chat/stream` 뒤에서 교체된다. MCP를 나중에 붙이면 도구 입력을 `{ q }`로 맞추고 반환을 `{ id, title }`로 제한한다. 사용자 토큰과 모델 키는 계속 다른 비밀이다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 질문 화면이 목록 상태를 덮음 | 한 `x-data`에 라우터와 질문을 같이 둠 | `#/ask` 안쪽에 `docAsk`를 둔다 |
| 삭제한 글이 알림으로 돌아옴 | 소켓 페이로드를 검증 없이 앞에 삽입 | `type`과 `id`를 확인하고, 필요하면 GET으로 다시 받는다 |
| 운영 페이지가 로컬 API를 호출 | 이미지에 개발 `config.js`를 복사 | 빌드 직전에 운영 원점으로 생성한다 |
| 스트리밍 버튼이 키를 요구하는 입력칸을 표시 | `aiStream`을 사용자 입력으로 켬 | 플래그는 배포 설정의 공개 불리언으로만 둔다. 키 입력칸은 만들지 않는다 |

## ⑥ 직접 해보기

1. `#/ask`에서 발췌가 없는 질문을 하고, `#/posts`로 갔다가 뒤로 가기로 돌아와도 토큰이 Local Storage에 없는지 본다.
2. 목록에서 글을 삭제한 직후 같은 검색을 다시 해서 캐시가 비워졌는지 확인한다.
3. `API_BASE`를 `http://` 운영 값으로 일부러 만들어 배포 체크리스트의 HTTPS 항목이 막는지 확인한 뒤 파일을 지운다.

## ⑦ ☐ 체크리스트

- [ ] 기능 목록의 각 항목이 study 번호의 컴포넌트 이름과 연결된다
- [ ] `index.html`의 프레임워크 스크립트는 Alpine 3.17.5와 공식 플러그인뿐이다
- [ ] DB 접속 정보와 모델 키가 정적 파일에 없다
- [ ] 배포 체크리스트의 401, 발췌, 캐시, 해시 오류를 한 번씩 확인했다
- [ ] 회고에 적은 제외 항목을 구현 순서에 다시 넣지 않았다

## ⑧ 다음 단계

이 저장소의 다음 수정은 새 프레임워크를 붙이는 일이 아니라, 스펙 v1 필드가 바뀔 때 `api.js`와 `postListPath`만 고치고 같은 점검표를 다시 실행하는 일이다.
