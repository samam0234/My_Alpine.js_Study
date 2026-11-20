# study12. 프론트·UI 연동

## ① 목표

Alpine 공식 플러그인과 `Alpine.data` UI 부품으로 열림, 포커스, 입력 형식을 처리한다.

## ② 📖 이론

### 왜 쓰는지

모달과 탭은 study2에서 직접 만들었다. 포커스를 대화상자 안에 가두고, 접힘을 높이와 함께 애니메이션하고, 초안을 저장하는 일은 공식 플러그인이 이미 다룬다. 플러그인은 Alpine 저장소의 확장이다. 버전은 본체와 같은 3.17.5를 쓴다.

### 핵심 개념

- `@alpinejs/collapse`: `x-collapse`. `x-show`와 함께 높이를 접는다.
- `@alpinejs/focus`: `x-trap`으로 모달 안의 Tab 이동을 가둔다.
- `@alpinejs/persist`: `$persist`로 테마 같은 비비밀 값만 `localStorage`에 둔다. 토큰에는 쓰지 않는다.
- `@alpinejs/mask`: `x-mask`로 표시 형식을 돕는다. 서버 검증을 대신하지 않는다.
- 상태: 열림은 컴포넌트 로컬, 로그인 사용자는 `auth` 스토어, 목록은 `posts` 스토어 또는 컴포넌트 필드. UI 플러그인이 스토어를 대체하지 않는다.
- 폼: study5의 `x-model`과 `validatePost`를 유지한다. 마스크는 보기용이다.
- 등록 순서: 플러그인 스크립트를 Alpine CDN보다 먼저 둔다. CDN 빌드는 파일만 먼저 있으면 자동 등록된다.

### 비유

플러그인은 같은 양념통에 끼우는 전용 뚜껑이다. 다른 부엌의 냄비로 국물을 옮기는 일이 아니다.

## ③ 🛠️ 실기

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Alpine UI</title>
  <style>[x-cloak]{display:none!important}</style>
  <script defer src="https://cdn.jsdelivr.net/npm/@alpinejs/persist@3.17.5/dist/cdn.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.17.5/dist/cdn.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/@alpinejs/focus@3.17.5/dist/cdn.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/cdn.min.js"></script>
  <script>
    document.addEventListener('alpine:init', () => {
      Alpine.data('shell', () => ({
        theme: Alpine.$persist('light'),
        helpOpen: false
      }))
      Alpine.data('dialog', () => ({
        open: false,
        show() { this.open = true },
        hide() { this.open = false }
      }))
    })
  </script>
</head>
<body x-data="shell" :data-theme="theme" x-cloak>
  <button type="button" @click="theme = theme === 'light' ? 'dark' : 'light'" x-text="theme"></button>
  <section x-data="{ open: true }">
    <button type="button" @click="open = !open">검색 도움말</button>
    <div x-show="open" x-collapse>
      <p>q는 제목과 본문을 서버에서 찾습니다.</p>
    </div>
  </section>
  <div x-data="dialog">
    <button type="button" @click="show()">작성 안내</button>
    <template x-if="open">
      <div x-trap="open" role="dialog" aria-modal="true">
        <p>제목은 1~200자입니다.</p>
        <button type="button" @click="hide()">닫기</button>
      </div>
    </template>
  </div>
</body>
</html>
```

### 줄별 설명

1. `persist`, `collapse`, `focus`의 3.17.5를 Alpine보다 먼저 `defer`로 읽는다.
2. `Alpine.$persist('light')`는 초기 테마다. 키에는 비밀이 없다.
3. `:data-theme`는 CSS가 읽을 속성 바인딩이다.
4. `x-collapse`는 바로 위의 `x-show`가 꺼질 때 높이를 접는다.
5. `x-trap="open"`은 대화상자가 열려 있을 때 포커스가 밖으로 나가지 않게 한다.
6. `template x-if`는 study2와 같이 닫히면 노드를 제거한다. `x-show`만 쓰면 숨은 대화상자가 탭 순서에 남을 수 있다.

## ④ 🔗 연동 포인트

`shell.theme`는 화면 선호일 뿐 API와 무관하다. 작성 폼의 오류 포커스는 `x-ref`로 첫 오류 필드에 `$refs.title.focus()`를 호출해 study5와 잇는다. 목록 데이터는 study11의 `listPosts` 결과를 그대로 쓰고, 플러그인 상태에 글을 저장하지 않는다. 운영 배포 목록에 플러그인 URL 세 개가 더 생긴다. 자체 호스팅으로 바꿀 때도 파일 버전은 3.17.5로 맞춘다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| `$persist is not defined` | 플러그인 스크립트가 Alpine보다 뒤 | `defer` 순서를 플러그인 먼저로 둔다 |
| 버전 오류 또는 동작 없음 | 플러그인 3.14와 본체 3.17을 혼용 | 모든 주소를 `@3.17.5`로 맞춘다 |
| 접힘이 즉시 사라짐 | `x-collapse`만 있고 `x-show`가 없음 | 둘을 같은 요소에 둔다 |
| 모달 밖이 계속 탭됨 | `x-trap`을 항상 거짓인 요소에 둠 | 열린 노드에 `x-trap="open"` |
| 테마 키에 토큰이 섞임 | `$persist`에 세션 객체를 넣음 | 테마 문자열만 저장한다 |
| 마스크를 통과했다고 서버가 거절 | 표시 형식과 검증을 같은 것으로 봄 | `validatePost`와 서버 `fields`를 유지한다 |

## ⑥ 직접 해보기

1. 테마를 바꾼 뒤 새로고침해 복원되는지, Application 패널의 값에 토큰이 없는지 본다.
2. 대화상자를 연 상태에서 Tab을 눌러 닫기 버튼 밖으로 나가지 않는지 확인한다.
3. 플러그인 스크립트 하나의 버전만 `3.17.4`로 바꿔 깨지는 증상을 본 뒤 3.17.5로 되돌린다.

## ⑦ ☐ 체크리스트

- [ ] 플러그인 네 종류 중 사용한 것의 버전이 Alpine 3.17.5와 같다
- [ ] 플러그인 스크립트가 본체보다 먼저다
- [ ] `$persist` 대상이 테마 또는 초안 범위이고 토큰이 아니다
- [ ] 모달은 `x-if`와 `x-trap`을 함께 쓴다
- [ ] `x-collapse`가 `x-show`와 같은 요소에 있다
- [ ] 목록 JSON 구조는 UI 상태와 분리되어 있다

## ⑧ 다음 단계

study13에서 파일 업로드, 메일 요청, 결제 시작, OAuth 복귀를 이 UI의 버튼과 폼에 연결한다.
