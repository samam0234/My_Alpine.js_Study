# study2. 핵심 구조

## ① 목표

Alpine의 기본 단위인 컴포넌트 스코프를 나누고, `x-for`·`x-if`와 모달·드롭다운·탭이 데이터와 이벤트로 대화하게 만든다.

## ② 📖 이론

### 왜 쓰는지

한 `x-data`에 화면 전체를 넣으면 이름 `open`이 모달인지 메뉴인지 알 수 없게 된다. `Alpine.data`로 컴포넌트를 등록하면 HTML은 `x-data="tabs"`처럼 이름만 부르고, 상태와 함수는 한 객체에 모인다.

### 핵심 개념

- **컴포넌트**: `Alpine.data('이름', () => ({ ... }))`로 등록한 상태 객체. HTML의 `x-data="이름"`이 그 객체를 스코프로 만든다. 등록은 `Alpine.start()` 이전이어야 하므로 CDN에서는 `document.addEventListener('alpine:init', ...)` 안에 등록한다.
- **중첩 스코프**: 안쪽 `x-data`는 바깥 값을 읽을 수 있다. 같은 이름을 안쪽에 선언하면 바깥 이름은 가려진다.
- **`x-for`**: 반드시 `<template>`에 둔다. `:key`는 각 항목의 안정적인 식별자다. 반복 변수는 그 템플릿 안의 스코프다.
- **`x-if`**: 역시 `<template>`에 둔다. 거짓이면 내용 요소를 DOM에서 제거한다. `x-show`와 달리 숨긴 채 유지하지 않는다.
- **한 템플릿에 `x-for`와 `x-if`를 같이 쓰지 않는다.** 바깥 템플릿이 반복하고, 안쪽 템플릿이 조건을 담당한다.
- **호출**: 부모는 자식에게 초기 값을 속성으로 넘기기보다, 자식이 읽는 바깥 상태를 두거나 `$dispatch`로 알린다. 자식은 `$dispatch('picked', id)`를 보내고 부모는 `@picked="선택($event.detail)"`으로 받는다. 멀리 떨어진 컴포넌트는 study3의 스토어를 쓴다.
- **`$refs`**: `x-ref="panel"`이 붙은 요소를 스크립트에서 가리킨다.

### 비유

컴포넌트는 칸막이가 있는 작업대다. 서랍(`x-data`)은 칸마다 따로이고, 쪽지(`$dispatch`)로 "3번 탭을 골랐다"고 옆 칸에 알린다. `x-for`는 같은 도장을 목록 길이만큼 찍는 일이고, `x-if`는 조건이 거짓이면 도장 자체를 책상에서 치우는 일이다.

### 디렉티브 정리

| 디렉티브 | 하는 일 |
| --- | --- |
| `x-data` | 스코프 생성 |
| `x-init` | 스코프가 준비된 뒤 한 번 실행. `await` 가능 |
| `x-text` / `x-html` | 텍스트 / HTML. `x-html`은 신뢰할 수 있는 문자열만 |
| `x-show` / `x-if` | 숨김 / DOM 제거. `x-if`는 `template` |
| `x-bind` 또는 `:` | 속성 바인딩. `:class`, `:disabled` |
| `x-on` 또는 `@` | 이벤트 |
| `x-model` | 폼 양방향 바인딩 |
| `x-for` | `template` 반복. `:key` 필수에 가깝다 |
| `x-ref` | `$refs`로 요소 참조 |
| `x-cloak` | 시작 전 숨김 |
| `x-transition` | 표시 전환 |
| `x-effect` | 의존 값이 바뀔 때 부수 효과 |
| `x-ignore` | 그 하위는 Alpine이 보지 않음 |
| `x-teleport` | 마크업은 여기, 실제 DOM은 다른 부모 |
| `x-id` | `$id('이름')`으로 라벨과 입력을 짝짓는 고유 id |

## ③ 🛠️ 실기

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Alpine 컴포넌트</title>
  <style>
    [x-cloak] { display: none !important; }
    .menu, .modal { border: 1px solid #999; padding: 0.5rem; margin-top: 0.5rem; }
    [aria-selected="true"] { font-weight: 700; }
  </style>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
  <script>
    document.addEventListener('alpine:init', () => {
      Alpine.data('boardShell', () => ({
        posts: [
          { id: 1, title: '공지', published: true },
          { id: 2, title: '초안', published: false }
        ],
        pickedId: null,
        pick(id) { this.pickedId = id }
      }))
      Alpine.data('dropdown', () => ({
        open: false,
        toggle() { this.open = !this.open },
        close() { this.open = false }
      }))
      Alpine.data('tabs', () => ({
        names: ['설명', '댓글'],
        current: '설명',
        select(name) { this.current = name }
      }))
      Alpine.data('modal', () => ({
        open: false,
        show() { this.open = true },
        hide() { this.open = false }
      }))
    })
  </script>
</head>
<body x-data="boardShell" x-cloak>
  <div x-data="dropdown" @click.outside="close()">
    <button type="button" @click="toggle()">글 목록 열기</button>
    <div class="menu" x-show="open">
      <template x-for="post in posts" :key="post.id">
        <div>
          <template x-if="post.published">
            <button type="button"
              @click="$dispatch('picked', post.id); close()"
              x-text="post.title"></button>
          </template>
        </div>
      </template>
    </div>
  </div>

  <p @picked.window="pick($event.detail)">
    고른 글 id: <span x-text="pickedId ?? '없음'"></span>
  </p>

  <div x-data="tabs">
    <template x-for="name in names" :key="name">
      <button type="button" @click="select(name)"
        :aria-selected="current === name" x-text="name"></button>
    </template>
    <template x-if="current === '설명'">
      <p>설명 패널</p>
    </template>
    <template x-if="current === '댓글'">
      <p>댓글 패널</p>
    </template>
  </div>

  <div x-data="modal">
    <button type="button" @click="show()">모달 열기</button>
    <template x-if="open">
      <div class="modal" role="dialog" aria-modal="true">
        <p>모달 내용</p>
        <button type="button" @click="hide()">닫기</button>
      </div>
    </template>
  </div>
</body>
</html>
```

### 줄별 설명

스타일 1~4행은 시작 전 숨김, 상자 테두리, 선택된 탭의 굵은 글씨다.

스크립트:

1. `alpine:init`은 CDN이 시작되기 전에 컴포넌트를 등록하는 시점이다.
2. `boardShell`은 글 배열과 선택된 id를 가진 바깥 스코프다.
3. `posts` 두 건. `published`로 화면 조건을 가른다.
4. 아직 고른 글이 없다.
5. `pick`은 부모 상태를 갱신하는 함수다.
6. `dropdown`은 자기 `open`만 가진다. 바깥 `posts`는 중첩 스코프라 읽을 수 있다.
7. `toggle`과 `close`는 메뉴 자신의 상태만 바꾼다.
8. `tabs`는 탭 이름과 현재 탭을 가진다.
9. `modal`은 `open`을 `x-if`와 연결하기 위해 따로 둔다. 드롭다운의 `open`과 이름이 같아도 스코프가 다르다.

본문:

1. `boardShell`이 페이지 스코프다. `x-cloak`으로 등록 전 깜빡임을 막는다.
2. 드롭다운 스코프. `@click.outside`는 이 요소 바깥 클릭이면 `close`를 호출한다.
3. 버튼은 메뉴의 `open`만 뒤집는다.
4. `x-show`라서 닫혀도 메뉴 DOM은 남고 `display`만 꺼진다.
5. `posts`는 바깥 `boardShell` 값이다. `:key="post.id"`로 항목을 식별한다.
6. 반복 안쪽 래퍼. `x-for`와 `x-if`를 한 태그에 두지 않기 위한 `div`다.
7. 공개된 글만 버튼을 만든다. 초안은 DOM에 없다.
8. 클릭하면 버블되는 `picked` 이벤트의 `detail`에 id를 싣고 메뉴를 닫는다.
9. 버튼 글자는 `post.title`이다.
10. 페이지의 `@picked.window`는 window까지 올라온 이벤트를 받아 `pick`을 호출한다.
11. 탭 컴포넌트는 자기 `current`만 바꾼다.
12. `:aria-selected`는 상태와 접근성 속성을 묶는 `x-bind`다.
13. 설명 패널과 댓글 패널은 `x-if`라서 현재 탭이 아니면 DOM에서 빠진다.
14. 모달은 `x-if="open"`이라 열리기 전에는 대화상자 노드가 없다.

## ④ 🔗 연동 포인트

`picked` 이벤트의 `detail`은 study4 라우터에서 "이 id의 상세로 이동"하는 입력으로 쓸 수 있다. `posts` 배열은 study3에서 스토어로 올리고, study6에서 `fetch` 결과로 바꾼다. 자식이 부모 함수를 직접 이름 없이 부르지 않고 이벤트를 쓰면, 나중에 상세 컴포넌트를 다른 부모 아래로 옮겨도 이벤트 이름만 유지하면 된다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `boardShell is not defined` | `alpine:init` 밖에서 등록했거나 스크립트가 Alpine보다 늦게 실행 | `defer` 스크립트를 Alpine 태그 바로 다음에 둔다 |
| 목록이 안 나오고 콘솔 오류 | `x-for`를 `template`이 아닌 `div`에 씀 | `<template x-for :key>`로 감싼다 |
| 초안도 버튼으로 남음 | `x-show`를 썼거나 `x-if`를 `x-for`와 같은 태그에 씀 | 안쪽 `template x-if`로 나눈다 |
| 탭을 눌러도 첫 패널만 보임 | 안쪽 스코프가 `current`를 새로 선언해 바깥을 가림 | 탭 상태는 `tabs` 한 곳에만 둔다 |
| 고른 id가 항상 없음 | `@picked`를 window 없이 이벤트보다 아래가 아닌 형제에만 둠 | 버블이 도달하는 조상 또는 `@picked.window`를 쓴다 |
| 항목을 지워도 엉뚱한 행이 갱신됨 | `:key`에 배열 인덱스를 씀 | `post.id`처럼 데이터 식별자를 쓴다 |

## ⑥ 직접 해보기

1. 초안도 보여 주되 버튼 대신 `초안` 글자만 `x-if` / `x-if`의 반대 템플릿으로 그린다.
2. 모달의 닫기 버튼을 `$dispatch('closed')`로 바꾸고, 바깥 스코프에서 그 사실을 한 줄 로그 문장으로 받는다.
3. 탭 이름을 `{ id: 'about', label: '설명' }` 객체 배열로 바꾸고 `:key`를 `tab.id`로 교체한다.

## ⑦ ☐ 체크리스트

- [ ] `x-for` 로 목록, `x-if` 로 조건 렌더링
- [ ] 모달·드롭다운·탭 컴포넌트
- [ ] `Alpine.data` 등록이 `alpine:init` 안에 있다
- [ ] `x-for`와 `x-if`가 서로 다른 `template`에 있다
- [ ] `:key`가 인덱스 숫자가 아니다
- [ ] 자식이 `$dispatch`로 id를 보내고 부모가 `$event.detail`로 받는다
- [ ] 드롭다운 `open`과 모달 `open`이 다른 스코프라 서로 덮지 않는다

## ⑧ 다음 단계

study3에서 페이지 스코프에 둔 `posts`와 선택 id를 `Alpine.store`로 옮기고, 입력 초안을 브라우저 저장소에 남긴다.
