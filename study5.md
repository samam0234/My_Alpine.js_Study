# study5. 폼·입력·검증

## ① 목표

글쓰기 입력을 검사하고, 필드 오류를 보여 주며, 제출 중 두 번째 요청을 막고, 상태 코드에 따라 화면을 바꾼다.

## ② 📖 이론

### 왜 쓰는지

빈 제목은 서버까지 갈 필요가 없다. 다만 브라우저 검사만 믿으면 서버의 400과 409를 화면에 담지 못한다. Alpine 폼은 보내기 전에 한 번 거르고, 응답의 `error.fields`가 있으면 그 문장을 필드 아래에 덮어쓴다.

### 핵심 개념

- **입력**: `x-model.trim`은 양 끝 공백을 걷고 상태에 넣는다. 제목은 1~200자, 본문은 1자 이상. 이 범위는 화면 규칙이고, 서버가 더 엄하면 서버 문장을 따른다.
- **오류 표시**: `errors.title` 배열의 첫 문장을 `x-text`로 보여 준다. `x-html`로 오류를 그리지 않는다.
- **중복 제출**: `submitting`이 참이면 버튼을 `:disabled`로 두고 `submit` 함수가 바로 return 한다.
- **상태 코드**:
  - `200` 또는 `201`: 성공. 작성은 공통 스펙상 `201`이고 `Location` 헤더가 있다. 화면은 목록으로 해시를 옮긴다.
  - `400` + `error.code === 'VALIDATION_ERROR'`: 스펙 v1의 검증 실패. `error.fields`를 그대로 표시한다.
  - `422`: 스펙 v1의 검증 코드는 400이다. 일부 서버가 422를 줄 수 있어, 본문이 같은 `error.fields` 모양이면 400과 같이 필드에 붙인다.
  - 그 외 4xx·5xx: `error.message` 한 줄을 폼 상단에 둔다.
- **낙관적 반영 금지**: 응답이 성공하기 전에는 스토어 목록에 글을 넣지 않는다.

### 비유

`submitting`은 주방에 주문서가 이미 들어갔다는 표시등이다. 표시등이 켜져 있는데 같은 주문서를 또 넣으면 같은 글이 두 그릇 나온다.

## ③ 🛠️ 실기

아래 예제는 네트워크 대신 `fakeResponse`가 상태 코드를 돌려준다. study6에서 이 함수만 `fetch`로 바꾼다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Alpine 폼</title>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
  <script>
    function validate(form) {
      const fields = {}
      if (form.title.length < 1 || form.title.length > 200) fields.title = ['1~200자로 입력하세요.']
      if (form.body.length < 1) fields.body = ['본문을 입력하세요.']
      return fields
    }

    function fakeResponse(form) {
      if (form.title === '중복') {
        return { status: 409, body: { error: { code: 'EMAIL_TAKEN', message: '이미 있는 값입니다.', fields: {}, requestId: 'local-1' } } }
      }
      if (form.title === '서버검증') {
        return { status: 400, body: { error: { code: 'VALIDATION_ERROR', message: '입력값을 확인하세요.', fields: { title: ['서버가 거절한 제목입니다.'] }, requestId: 'local-2' } } }
      }
      if (form.title === '레거시') {
        return { status: 422, body: { error: { code: 'VALIDATION_ERROR', message: '입력값을 확인하세요.', fields: { body: ['422 필드 오류'] }, requestId: 'local-3' } } }
      }
      return { status: 201, body: { data: { id: 10, title: form.title, body: form.body } } }
    }

    document.addEventListener('alpine:init', () => {
      Alpine.data('writer', () => ({
        form: { title: '', body: '' },
        errors: {},
        formError: '',
        submitting: false,
        async submit() {
          if (this.submitting) return
          this.errors = validate(this.form)
          this.formError = ''
          if (Object.keys(this.errors).length) return
          this.submitting = true
          try {
            const res = fakeResponse(this.form)
            if (res.status === 201 || res.status === 200) {
              this.form = { title: '', body: '' }
              location.hash = '#/posts'
              return
            }
            const error = res.body.error || {}
            if ((res.status === 400 || res.status === 422) && error.fields) {
              this.errors = error.fields
              this.formError = error.message || ''
              return
            }
            this.formError = (error.message || '요청을 처리하지 못했습니다.') + (error.requestId ? ' (' + error.requestId + ')' : '')
          } finally {
            this.submitting = false
          }
        }
      }))
    })
  </script>
</head>
<body>
  <form x-data="writer" @submit.prevent="submit()">
    <p x-show="formError" x-text="formError"></p>
    <label>
      제목
      <input name="title" x-model.trim="form.title" :aria-invalid="Boolean(errors.title)">
    </label>
    <p x-show="errors.title" x-text="errors.title ? errors.title[0] : ''"></p>
    <label>
      본문
      <textarea name="body" x-model.trim="form.body"></textarea>
    </label>
    <p x-show="errors.body" x-text="errors.body ? errors.body[0] : ''"></p>
    <button type="submit" :disabled="submitting" x-text="submitting ? '보내는 중' : '등록'"></button>
  </form>
</body>
</html>
```

제목을 비우면 요청 함수 전에 문장이 나온다. `서버검증`은 400 필드 오류, `레거시`는 422 필드 오류, `중복`은 409 상단 메시지, 그 외 정상 제목은 해시가 `#/posts`로 바뀐다. 버튼을 연타해도 `submitting` 동안은 `disabled`다.

### 줄별 설명

1. `validate`는 서버로 가기 전의 필드 맵이다. 스펙의 `fields`와 같이 `{ 필드: [문장] }`이다.
2. `fakeResponse`는 제목 키워드로 201·400·409·422를 구분하는 대역이다. 실제 서버가 아니다.
3. `409` 예는 스펙의 오류 모양을 맞추기 위한 것이다. 글 제목 중복의 표준 코드는 스펙에 없고, 이메일 중복만 `EMAIL_TAKEN`이다. 화면은 `message`만 쓴다.
4. `submit`의 첫 줄이 재진입을 막는다.
5. 로컬 `errors`가 있으면 네트워크 대역을 호출하지 않는다.
6. `submitting`을 켠 뒤에만 응답을 해석한다.
7. `201`과 `200`은 성공이다. 폼을 비우고 목록 해시로 이동한다.
8. `400`과 `422`는 `fields`가 있을 때 필드 오류로 흡수한다.
9. 나머지 코드는 `message`와 `requestId`를 상단에 붙인다.
10. `finally`는 성공·실패 모두 버튼을 다시 연다.
11. `@submit.prevent`는 브라우저의 기본 제출을 막는다.
12. `x-model.trim`이 상태 값을 다듬는다.
13. `:disabled="submitting"`이 두 번째 클릭을 막는다.

## ④ 🔗 연동 포인트

study6의 `POST /api/posts`는 같은 `submit`에서 `fakeResponse` 자리에 들어간다. 요청 본문은 `{ title, body, tags }`이고 필드 이름은 camelCase다. 성공 시 `201`과 `Location: /api/posts/{id}`를 읽고, 있으면 해시를 `#/posts/{id}`로 옮긴다. `error.requestId`는 서버 로그를 찾을 키이므로 사용자에게 짧은 접미로만 보여 주고, 스택은 보여 주지 않는다. 로그인 전이면 study7이 `401`을 같은 `formError` 경로로 받는다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 빈 제목인데 성공 해시로 이동 | `validate` 전에 `fakeResponse`를 호출 | 로컬 오류가 있으면 return 한다 |
| 버튼을 연타해 성공이 두 번 | `submitting`을 응답 전에 안 켬 | 검사 통과 직후 `true`, `finally`에서 `false` |
| 400인데 필드 아래가 비음 | `error.details` 등 다른 키를 읽음 | 스펙은 `error.fields`다 |
| 422를 일반 실패로만 표시 | 400만 분기함 | `fields`가 있는 422도 필드 맵에 넣는다 |
| 오류 HTML이 실행됨 | `x-html="formError"` | `x-text`만 사용한다 |
| 공백만 있는 제목이 통과 | `x-model`에 `.trim`이 없음 | `x-model.trim` 또는 검사 전에 `trim()` |

## ⑥ 직접 해보기

1. 제목을 201자로 만들어 로컬 문장 `1~200자로 입력하세요.`가 나오는지 본다.
2. `fakeResponse`에 `status: 500` 분기를 추가하고 상단 메시지만 보이는지 확인한다.
3. 제출 함수 첫 줄의 `if (this.submitting) return`을 주석 처리하지 않은 채, `disabled`만 빼서 키보드 연타가 여전히 한 번으로 막히는지 본다.

## ⑦ ☐ 체크리스트

- [ ] 제목 1~200자, 빈 본문을 보내기 전에 막는다
- [ ] 필드 오류는 `x-text`로 첫 문장만 보여 준다
- [ ] `submitting`과 `:disabled`가 함께 있다
- [ ] `200`·`201`은 폼을 비우고 목록 해시로 이동한다
- [ ] `400`과 `422`의 `error.fields`는 필드에, 그 외는 `error.message`와 `requestId`를 상단에 둔다
- [ ] 성공 응답 전에는 목록 스토어를 고치지 않는다

## ⑧ 다음 단계

study6에서 대역 함수를 공통 스펙의 `fetch`로 바꾸고, `x-init`으로 게시판 목록을 불러 CRUD를 닫는다.
