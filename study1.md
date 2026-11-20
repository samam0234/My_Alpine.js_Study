# study1. Hello World와 기본 문법

## ① 목표

한 페이지에서 `x-data`, `x-text`, `x-show`, `x-on:click`(`@click`), `x-model`로 글자·표시·클릭·입력을 연결한다.

## ② 📖 이론

### 왜 쓰는지

DOM을 찾아 `textContent`를 직접 고치면 상태와 화면이 두 곳에 생긴다. Alpine은 상태를 `x-data` 한 곳에 두고, 화면 속성은 그 상태를 읽기만 한다. 값을 바꾸면 그 값을 읽는 속성이 다시 평가된다.

### 핵심 개념

- `x-data="{ key: value }"` 또는 `x-data="이름"`: 스코프의 초기 상태. 빈 `x-data`도 스코프를 만든다.
- `x-text="표현식"`: 요소의 텍스트. HTML로 해석하지 않는다.
- `x-show="조건"`: 거짓이면 `display: none`. 요소는 DOM에 남는다.
- `x-on:click="식"`과 `@click="식"`: 같은 클릭 리스너. `@`는 `x-on:`의 짧은 표기다.
- `x-model="이름"`: 입력의 `value`와 상태를 양방향으로 묶는다.
- 표현식은 JavaScript다. `count + 1`, `open = !open`처럼 적는다.
- `x-cloak`: Alpine이 평가하기 전에 깜빡이는 템플릿을 가릴 때 쓴다. CSS `[x-cloak] { display: none !important; }`가 필요하다. Alpine이 준비되면 이 속성을 걷어 낸다.

### 비유

`x-data`는 화이트보드, `x-text`는 보드를 베껴 쓰는 표시등, `x-model`은 보드와 연결된 자석 글자판, `@click`은 보드의 숫자를 하나 올리는 버튼이다. 전등을 끈 `x-show`는 전구를 빼지 않고 스위치만 내린 것이다.

## ③ 🛠️ 실기

`index.html` 전체를 아래로 바꾼다. study0의 개발 서버를 켠 채 저장하면 Live Server는 자동으로 새로고침한다. `npx serve`는 저장만으로 새로고침되지 않으므로 브라우저에서 직접 새로고침한다.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Alpine Hello</title>
  <style>
    [x-cloak] { display: none !important; }
    body { font-family: sans-serif; margin: 2rem; }
    label { display: block; margin-top: 1rem; }
  </style>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
</head>
<body>
  <div x-data="{ name: 'Alpine', count: 0, open: true }" x-cloak>
    <h1 x-text="'안녕, ' + name"></h1>
    <p x-show="open">이 문장은 open이 참일 때만 보입니다.</p>
    <button type="button" x-on:click="count = count + 1">x-on으로 증가</button>
    <button type="button" @click="open = !open">@click으로 토글</button>
    <p x-text="'클릭 수 ' + count"></p>
    <label>
      이름
      <input x-model="name">
    </label>
  </div>
</body>
</html>
```

개발자도구에서 확인한다.

1. Elements 패널에서 `h1`의 텍스트가 `안녕, Alpine`인지 본다.
2. 이름 입력에 `친구`를 치면 제목이 `안녕, 친구`로 바뀌는지 본다.
3. 토글 버튼을 눌러 `x-show` 문단의 style에 `display: none`이 붙는지 본다.
4. Console에 오류가 없는지 본다. 자동 새로고침을 쓰는 경우 Network 패널을 끄지 않은 채 저장해 HTML이 다시 요청되는지만 확인하면 된다.

### 줄별 설명

1. 문서 형식.
2. 한국어 HTML.
3. `head` 시작.
4. UTF-8.
5. 제목.
6. 페이지 전용 스타일 시작.
7. Alpine 시작 전 `[x-cloak]` 요소를 숨긴다.
8. 여백과 글꼴.
9. 라벨을 블록으로 내려 입력과 버튼을 겹치지 않게 한다.
10. 스타일 끝.
11. Alpine 3.17.5. `defer`로 본문 파싱 뒤에 실행.
12. `head` 끝.
13. `body` 시작.
14. 한 스코프에 `name`, `count`, `open`을 선언한다. `x-cloak`은 평가 전 깜빡임을 막는다.
15. 제목 텍스트를 표현식으로 채운다. 태그로 해석되지 않는다.
16. `open`이 참일 때만 문단을 보여 준다.
17. `x-on:click`으로 `count`를 1 증가시킨다. `type="button"`이라 폼 제출이 아니다.
18. `@click`은 17번과 같은 종류의 리스너다. `open`을 뒤집는다.
19. 현재 `count`를 텍스트로 보여 준다.
20. 입력 라벨 시작.
21. 라벨 글자.
22. `x-model`이 입력값과 `name`을 묶는다. 입력이 바뀌면 15번 제목도 바뀐다.
23. 라벨 끝.
24. 스코프 `div` 끝.
25. `body` 끝.
26. 문서 끝.

## ④ 🔗 연동 포인트

이 페이지의 상태가 이후 화면의 최소 단위다. study2는 이 스코프 안에 목록과 조건 템플릿을 넣고, study3은 `name` 같은 값을 스토어와 `localStorage`로 옮긴다. 자동 새로고침은 에디터 확장의 기능이고 Alpine의 기능이 아니다. `npx serve`를 쓸 때는 저장 후 브라우저 새로고침이 확인 방법이다. 개발자도구의 Elements는 결과가 맞는지, Console은 표현식 오타를 잡는 곳이다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `안녕,` 제목이 비어 있다 | `name`을 `x-data`에 선언하지 않음 | 초기 객체에 `name: ''`을 넣는다 |
| 버튼을 눌러도 숫자가 그대로 | 클릭한 요소가 스코프 바깥 | `x-data` 요소 안으로 버튼을 옮긴다 |
| 입력이 제목을 안 바꾼다 | `x-model="name"` 오타 또는 다른 스코프의 `name` | 같은 `x-data` 안의 철자를 맞춘다 |
| 새로고침 전에 `x-text="'안녕...'"`가 번쩍인다 | `x-cloak` CSS가 없음 | `[x-cloak]` 규칙을 `head`에 둔다 |
| `@click`이 페이지를 새로고침 | `button`이 폼 안의 기본 `submit` | `type="button"`을 준다 |
| 콘솔에 `Unexpected token` | `x-data` 객체의 따옴표 또는 쉼표 오류 | 속성을 작은따옴표 HTML, 안쪽 문자열을 큰따옴표로 나누거나 반대로 통일한다 |

## ⑥ 직접 해보기

1. `count`가 3보다 클 때만 보이는 문단을 `x-show="count > 3"`으로 추가한다.
2. `@click`에 `.prevent`를 붙여 `<a href="#top" @click.prevent="count++">`가 주소 해시를 바꾸지 않는지 본다.
3. 개발자도구에서 `h1`을 선택한 뒤 Alpine이 텍스트 노드만 바꾸는지, 입력한 `<b>`가 태그로 해석되지 않는지 `x-model`에 `<b>안녕</b>`를 넣어 확인한다.

## ⑦ ☐ 체크리스트

- [ ] `x-data`, `x-text`, `x-show`, `x-on:click`(`@click`), `x-model` 기본
- [ ] 제목은 `x-text`만으로 바뀌고 HTML로 실행되지 않는다
- [ ] `@click`과 `x-on:click`이 같은 스코프의 값을 고친다
- [ ] `x-show`가 요소를 지우지 않고 `display`만 바꾼다
- [ ] 저장 후 새로고침 또는 Live Server 자동 새로고침으로 결과를 다시 봤다
- [ ] Console에 평가 오류가 없다

## ⑧ 다음 단계

study2에서 이 스코프를 컴포넌트로 나누고, `x-for`와 `x-if`로 목록·조건을 그리며 모달·드롭다운·탭이 서로 이벤트를 주고받게 만든다.
