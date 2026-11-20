# study14. API 설계

## ① 목표

Alpine 클라이언트가 스펙 v1의 경로·버전·페이지·오류를 하나의 규칙으로 읽고, 그 규칙을 OpenAPI 문서와 대조한다.

## ② 📖 이론

### 왜 쓰는지

화면마다 쿼리 이름을 만들면 목록은 `page`, 다른 화면은 `p`가 된다. 설계 문서는 서버만을 위한 것이 아니다. Alpine이 보내는 문자열을 고정하는 계약이다. 문서가 `/api-docs`에 있고 응답이 문서와 다르면 화면은 문서가 아니라 실제 JSON을 따르되, 그 차이를 오류로 남긴다.

### 핵심 개념

- **리소스**: 복수 명사, 소문자, 하이픈. `/api/posts`, `/api/posts/{id}`, `/api/posts/{id}/comments`. 동사 경로를 만들지 않는다.
- **메서드**: 조회 GET, 생성 POST, 부분 수정 PATCH, 삭제 DELETE. 수정은 PUT을 쓰지 않는다.
- **버전**: 스펙 v1은 경로에 `/v1`을 넣지 않고 `/api`를 쓴다. 나중에 깨지는 변경이 생기면 `/api/v2`를 `API_BASE`가 아니라 경로 상수 `API_PREFIX`로 한 파일에 적는다. 화면 컴포넌트는 접두어를 직접 붙이지 않는다.
- **페이지네이션**: `page` 기본 1, `limit` 기본 10·최대 50, `q`, `sort=-createdAt`. 응답 `meta.totalPages`.
- **오류**: `{ error: { code, message, fields, requestId } }`. 상태와 코드는 study5·study6의 표와 같다.
- **문서**: 서버의 `/api-docs`(OpenAPI 3). Alpine 저장소에는 클라이언트가 의존하는 최소 YAML을 `api/openapi-client.md` 대신 이 문서의 코드 블록으로 둔다. 브라우저에 Swagger UI 서버를 새로 띄우지 않는다.

### 비유

OpenAPI는 주문서 양식의 견본이다. 창구마다 다른 낙서를 하지 않고, 견본에 없는 칸이 응답에 있으면 그 칸을 화면에 그리지 않는다.

## ③ 🛠️ 실기

클라이언트가 기대하는 최소 문서다.

```yaml
openapi: 3.0.3
info:
  title: board client contract
  version: 1.0.0
paths:
  /api/posts:
    get:
      parameters:
        - in: query
          name: page
          schema: { type: integer, minimum: 1, default: 1 }
        - in: query
          name: limit
          schema: { type: integer, minimum: 1, maximum: 50, default: 10 }
        - in: query
          name: q
          schema: { type: string }
        - in: query
          name: sort
          schema: { type: string, enum: [createdAt, -createdAt, -commentCount] }
      responses:
        '200':
          description: 목록
```

경로 상수는 `js/pure.js`에 둔다.

```javascript
const API_PREFIX = '/api'

function postListPath(query) {
  const params = new URLSearchParams()
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10))
  params.set('page', String(page))
  params.set('limit', String(limit))
  params.set('sort', ['createdAt', '-createdAt', '-commentCount'].includes(query.sort) ? query.sort : '-createdAt')
  if (query.q) params.set('q', query.q)
  return API_PREFIX + '/posts?' + params.toString()
}

function errorText(error) {
  if (!error) return '요청을 처리하지 못했습니다.'
  return error.message || error.code || '요청을 처리하지 못했습니다.'
}
```

화면의 페이지 이동은 `meta.page`와 `meta.totalPages`만 사용한다. `limit` 입력은 50을 넘기면 보내기 전에 50으로 맞춘다. 서버도 50으로 자르지만 클라이언트가 먼저 맞춘다.

### 줄별 설명

1. YAML의 `version: 1.0.0`은 문서 버전이다. 경로의 v1과 숫자 의미가 다를 수 있어 화면 분기에 쓰지 않는다.
2. 쿼리 네 개만 허용 목록에 있다.
3. `sort` 열거형은 스펙의 세 값이다. 다른 문자열은 `-createdAt`으로 바꾼다.
4. `API_PREFIX`를 한 상수로 두면 v2가 필요할 때 이 줄과 `api()`의 조합만 검사하면 된다.
5. `postListPath`는 페이지를 1 미만으로 내리지 않고 limit을 1~50으로 자른다.
6. `errorText`는 `message`를 우선한다. `fields` 문장은 필드 아래에 따로 그린다.

## ④ 🔗 연동 포인트

study6의 `load`는 문자열 연결 대신 `postListPath`를 호출한다. study13의 업로드·메일·결제는 스펙 표에 없는 경로이므로 OpenAPI에 같은 오류 스키마를 추가하기 전에는 화면 기능으로 고정하지 않는다. `/api-docs`를 사람 링크 `<a href>`로 API 원점에 연결할 수는 있다. 그 페이지가 Alpine 라우터의 `#/...`와 섞이지 않게 절대 원점 `API_BASE + '/api-docs'`를 쓴다. 배포 환경이 경로를 `/api/v2`로 바꾸면 `API_PREFIX`와 생성되는 `config.js`의 설명을 같이 바꾸고, 컴포넌트의 `x-for`는 유지한다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `limit=1000`을 그대로 전송 | 입력값을 검사하지 않음 | 1~50으로 자른 뒤 쿼리를 만든다 |
| `sort=title`이 서버 400 | 열거형 밖 | 허용 목록 밖은 `-createdAt` |
| 오류 본문이 최상위 `message` | 스펙의 `error` 래퍼가 아님 | `body.error`만 읽는다. 없으면 `INTERNAL`로 표시하고 원문을 화면에 뿌리지 않는다 |
| 페이지가 0부터 비어 있음 | `page=0` 전송 | `Math.max(1, page)` |
| v1과 v2 화면이 한 템플릿에 섞임 | 컴포넌트 안의 if 경로 | 접두어는 `API_PREFIX` 하나 |
| OpenAPI와 응답의 필드가 다름 | 문서가 오래됨 | 화면은 스펙 필드만 읽고, 차이 나는 키 이름을 오류 노트에 적는다 |

## ⑥ 직접 해보기

1. `page`에 `0`, `-3`, `'abc'`를 넣어 결과가 모두 `page=1`인지 함수 테스트로 확인한다.
2. `limit`에 `51`을 넣어 쿼리가 `limit=50`인지 본다.
3. 오류 객체에 `fields`만 있고 `message`가 없을 때 상단 문장이 빈 문자열이 아닌지 `errorText`를 확인한다.

## ⑦ ☐ 체크리스트

- [ ] 경로는 복수 명사와 `/api` 접두어다
- [ ] 수정은 PATCH만 호출한다
- [ ] `page` `limit` `q` `sort`가 스펙 범위 밖이면 클라이언트에서 고친다
- [ ] 오류는 `error.code` `error.message` `error.fields` `error.requestId`만 사용한다
- [ ] `API_PREFIX`가 한 파일에만 있다
- [ ] `/api-docs` 링크가 있다면 `API_BASE` 기준이다
- [ ] 응답의 추가 필드를 화면에 새로 그리지 않는다

## ⑧ 다음 단계

study15에서 같은 목록 요청이 반복될 때 취소·캐시·측정으로 화면 갱신만 줄인다.
