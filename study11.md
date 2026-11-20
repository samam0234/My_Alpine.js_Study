# study11. DB 확장

## ① 목표

Alpine에 ORM과 DB 접속이 없다는 경계를 고정하고, 저장 어댑터를 바꿔도 화면이 스펙 v1 JSON만 보게 한다.

## ② 📖 이론

### 왜 쓰는지

MariaDB, PostgreSQL, MongoDB는 서버 프로세스의 저장소다. Alpine은 그 프로세스에 들어갈 드라이버와 ORM 설정 화면을 제공하지 않는다. 브라우저 번들에 접속 문자열을 넣는 순간 비밀번호가 공개된다. 이 단계의 "DB를 바꾼다"는 API 서버의 저장소가 바뀌어도 `js/api.js`와 컴포넌트를 고치지 않도록 계약을 잠그는 일이다.

### 핵심 개념

Alpine 쪽 어댑터는 두 개만 둔다.

| 어댑터 | 쓰는 곳 | 하는 일 |
| --- | --- | --- |
| `http` | 개발·운영 | `API_BASE`로 스펙 v1 호출 |
| `memory` | 테스트, API가 없을 때의 UI 연습 | 프로세스 메모리의 배열. 새로고침하면 사라진다 |

ORM 설정 차이는 Alpine 설정 파일이 아니라, **API가 새면 안 되는 저장소 습관**으로 정리한다.

| 저장소 | 서버에서 흔한 습관 | Alpine이 받으면 안 되는 것 | 화면이 요구하는 값 |
| --- | --- | --- | --- |
| MariaDB | 정수 PK, `snake_case` 컬럼 | `created_at`, 드라이버 오류 문자열 | `createdAt`, ISO 8601 UTC |
| PostgreSQL | 정수 또는 UUID, 타임존 있는 시각 | 원문 타임존 객체 | 같은 ISO 문자열, `id`는 JSON 숫자 또는 스펙이 정한 값 |
| MongoDB | `_id` 문자열, 문서 중첩 | `_id`, `$oid` | `id` 필드. 없으면 목록 키로 쓰지 않는다 |

공통으로 막을 것: 비밀번호 해시, 내부 경로, SQL 문, 스택. 페이지네이션은 저장소의 offset/skip을 그대로 주지 않고 `meta.page`로 받는다. MongoDB식 `skip`을 쿼리 이름으로 쓰지 않는다. 스펙의 `page`는 1부터다.

서버가 ORM으로 그 변환을 하든 수동으로 하든 Alpine의 `config.js`에는 ORM 이름이 없다.

### 비유

화면은 메뉴판의 음식 이름만 본다. 주방이 냉장고를 바꿔도 메뉴판의 `title`과 `createdAt`이 같으면 홀 직원은 냉장고 설명서를 다시 읽지 않는다.

## ③ 🛠️ 실기

```javascript
function createMemoryPosts() {
  const items = []
  return {
    async list({ page = 1, limit = 10, q = '' }) {
      const filtered = items.filter((item) => item.title.toLowerCase().includes(q.toLowerCase()))
      const start = (page - 1) * limit
      const slice = filtered.slice(start, start + limit)
      return {
        data: slice,
        meta: { page, limit, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)), q }
      }
    },
    async create(input) {
      const row = { id: items.length + 1, title: input.title, body: input.body, tags: input.tags || [], author: { id: 1, nickname: 'local' }, commentCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      items.push(row)
      return { status: 201, data: row }
    }
  }
}

async function listPosts(port, query) {
  if (port.kind === 'memory') return port.memory.list(query)
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit), sort: '-createdAt' })
  if (query.q) params.set('q', query.q)
  return api('/api/posts?' + params.toString())
}
```

화면은 `listPosts(port, query)`의 `data`만 `x-for`에 넣는다. `port.kind`를 템플릿에 적지 않는다.

### 줄별 설명

1. `createMemoryPosts`는 테스트용 배열이다. 접속 문자열이 없다.
2. `list`는 `q`를 대소문자 무시로 거르고 `page`를 1부터 센다.
3. `meta.totalPages`는 0건이어도 최소 1로 두어 이전/다음 버튼 계산이 나눗셈 0이 되지 않게 할 수 있다. 총 0건을 0페이지로 두는 서버라면 버튼 비활성 조건을 `total === 0`으로 추가한다.
4. `create`가 만드는 필드는 스펙의 단건 `data`와 같다. `_id`를 만들지 않는다.
5. `createdAt`은 `toISOString()`이다.
6. `listPosts`는 `memory`가 아니면 기존 `api()`만 호출한다.
7. 컴포넌트는 어댑터 종류를 모르므로 MariaDB로 바뀌었는지 화면 코드가 알 필요가 없다.

## ④ 🔗 연동 포인트

운영에서 `port.kind`는 항상 `http`다. `memory`는 `node --test`와 디자인 확인에만 쓴다. API 서버가 MariaDB에서 PostgreSQL이나 MongoDB로 바뀌면 서버 환경 변수만 바뀌고 Alpine의 `API_BASE`는 그대로다. 화면이 `_id`나 `created_at`을 읽기 시작하면 그 저장소에 묶인 것이므로 `data.id`와 `data.createdAt`으로 되돌린다. studymidpoint의 `postList`는 이 `listPosts`를 호출하도록만 바꾼다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 목록 키가 비어 있음 | MongoDB `_id`를 그대로 받음 | API가 `id`로 바꿔 주는지 Network 응답을 본다. Alpine에서 `_id`를 읽지 않는다 |
| 날짜가 객체로 보임 | 직렬화 누락 | 문자열 ISO만 `x-text` 한다. 객체면 서버 응답이 스펙 밖이다 |
| `page=0`이 빈 목록 | 서버 페이지가 0부터 | 쿼리는 항상 1 이상. Alpine이 0을 보내지 않는다 |
| 비밀번호가 응답에 있음 | ORM 모델을 그대로 JSON으로 출력 | 화면은 그 필드를 그리지 않고, 응답을 스펙 필드로 제한하라고 API를 고친다 |
| `memory` 데이터가 운영에 남음 | `kind` 기본값이 `memory` | 기본값은 `http`이고 `memory`는 테스트에서만 주입한다 |
| 브라우저가 DB 포트로 접속 | `config.js`에 DB 호스트를 넣음 | `API_BASE`만 남긴다 |

## ⑥ 직접 해보기

1. `memory.list`에 `q: '첫'`을 넣어 대소문자가 다른 제목도 포함되는지 테스트로 확인한다.
2. 응답 예제에서 `created_at`만 있는 객체를 일부러 넣어 제목은 나오고 날짜 칸이 비는지 본 뒤, 매핑을 화면이 아니라 응답 예제 수정으로 고친다.
3. `id`가 문자열 `'1'`인 항목의 `:key`가 상세 링크 `#/posts/1`과 어떻게 다른지 적는다. 상세 요청 전에 스펙이 정한 타입으로 서버가 맞춰 주는지 확인한다.

## ⑦ ☐ 체크리스트

- [ ] Alpine 설정에 ORM 패키지와 DB 접속 문자열이 없다
- [ ] `http`와 `memory` 어댑터의 반환이 둘 다 `{ data, meta }`다
- [ ] MariaDB·PostgreSQL·MongoDB의 내부 키를 템플릿이 읽지 않는다
- [ ] 날짜는 ISO 8601 문자열만 표시한다
- [ ] `page`는 1부터이고 `skip` 쿼리를 만들지 않는다
- [ ] 운영 기본 어댑터는 `http`다

## ⑧ 다음 단계

study12에서 이 목록 화면의 열고 닫는 동작을 Alpine 공식 플러그인과 재사용 컴포넌트로 다듬는다.
