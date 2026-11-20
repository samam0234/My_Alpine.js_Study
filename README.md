# Alpine.js 학습 노트

Alpine.js **3.17.5** 하나만 다루는 학습 문서다. 서버가 만든 HTML에 `x-data` 같은 속성을 얹어 모달, 탭, 입력, 목록을 반응형으로 만든다. 빌드 도구 없이 `<script defer>` 한 줄로 시작할 수 있다.

공식 문서: [Alpine.js](https://alpinejs.dev) · 설치: [Installation](https://alpinejs.dev/essentials/installation) · 릴리스: [v3.17.5](https://github.com/alpinejs/alpine/releases/tag/v3.17.5)

공통 게시판 계약은 `GET /api/posts`를 포함한 API 스펙 v1이다. 브라우저에 실리는 값은 공개 `API_BASE`뿐이다. DB 비밀번호, AI API 키, OAuth 시크릿은 이 저장소의 문서 예제에 넣지 않는다.

## 문서 지도

| 파일 | 내용 |
| --- | --- |
| [study0.md](study0.md) | 설치, 버전 확인, 폴더, 개발 서버, 확장 프로그램, Git, `.env` |
| [study1.md](study1.md) | 첫 화면, `x-data` `x-text` `x-show` `@click` `x-model` |
| [study2.md](study2.md) | `x-for` `x-if`, 모달·드롭다운·탭, 스코프와 이벤트 |
| [study3.md](study3.md) | 상태, `Alpine.store`, 바인딩, `localStorage` |
| [study4.md](study4.md) | 해시 라우팅, 동적 경로, 쿼리, 오류 화면 |
| [study5.md](study5.md) | 입력, 검증, 오류 메시지, 중복 제출 방지, 상태 코드 |
| [study6.md](study6.md) | 스펙 v1 CRUD, `x-init` + `fetch`, 환경 변수로 주소 분리 |
| [study7.md](study7.md) | 로그인 스토어, 토큰, 권한, CORS, XSS·CSRF |
| [study8.md](study8.md) | 폴더 정리, 공통 모듈, 개발·운영 설정 |
| [study9.md](study9.md) | 순수 함수 테스트, mock `fetch`, 디버깅, 오류 10개 |
| [study10.md](study10.md) | 정적 배포, HTTPS, 기초 총정리, 배포 후 점검 |
| [studymidpoint.md](studymidpoint.md) | study0~10만으로 만드는 작은 게시판 |
| [study11.md](study11.md) | Alpine이 DB/ORM을 갖지 않는 이유와 저장 어댑터 |
| [study12.md](study12.md) | 공식 플러그인과 재사용 UI |
| [study13.md](study13.md) | 업로드, 메일 요청, 결제 시작, OAuth 복귀 |
| [study14.md](study14.md) | REST 소비, 페이지네이션, 오류 형식, OpenAPI |
| [study15.md](study15.md) | 캐시, 요청 취소, 비동기 큐, 측정 |
| [study16.md](study16.md) | nginx, GitHub Actions, 로그, 백업 점검표 |
| [study17.md](study17.md) | WebSocket, 알림, 파일 읽기 |
| [study18.md](study18.md) | AI 스트리밍 UI, 프롬프트, MCP 개념, DocuForge형 발췌 인용 |
| [studyfinal.md](studyfinal.md) | 심화까지 합친 Alpine 단일 서비스 설계 |

각 학습 문서의 실행 예제는 해당 파일의 HTML 코드 블록이다. 블록을 `index.html`로 저장한 뒤 study0의 개발 서버로 연다. `file://`로 열면 `fetch`와 모듈이 막힌다.

## 원문 체크 항목을 넣은 곳

| 원문 | 문서 |
| --- | --- |
| `x-data`, `x-text`, `x-show`, `x-on:click`(`@click`), `x-model` 기본 | study1 |
| `x-for` 로 목록, `x-if` 로 조건 렌더링 | study2 |
| 모달·드롭다운·탭 컴포넌트 | study2 |
| `fetch` 로 게시판 API 목록 불러오기 (`x-init`) | study6 |
| `Alpine.store` 로 전역 상태(로그인 사용자) | study7 |

`Django + HTMX 화면에 Alpine을 함께 붙여보기`는 다른 프레임워크와 통합하지 않는다는 조건 때문에 체크리스트에 넣지 않았다.
