# study15. 성능·캐시

## ① 목표

같은 목록 요청을 겹치지 않게 취소하고, 짧은 캐시와 비동기 큐로 화면 갱신을 줄이며, 브라우저 시계로 그 차이를 측정한다.

## ② 📖 이론

### 왜 쓰는지

검색 입력마다 `GET /api/posts`를 보내면 느린 응답이 나중에 도착해 새 검색 결과를 덮어쓴다. Alpine은 서버 캐시 서버가 아니다. 브라우저 안에서 할 수 있는 일은 요청을 늦추고, 이전 요청을 취소하고, 같은 쿼리의 최근 응답을 잠깐 재사용하고, 긴 작업을 한 줄로 세우는 것이다.

### 핵심 개념

- **디바운스**: 입력이 300ms 잠잠할 때만 `load`를 호출한다.
- **취소**: `AbortController`. 새 검색이 시작되면 이전 `controller.abort()`를 호출한다. 취소된 오류는 사용자 메시지로 올리지 않는다.
- **캐시**: `Alpine.store('cache')`에 `키 → { at, value }`를 둔다. 키는 `postListPath(query)`다. 30초 안의 같은 키는 네트워크를 생략한다. 인증이 필요한 쓰기 직후에는 그 키를 지운다. 토큰은 캐시 값에 넣지 않는다.
- **비동기 큐**: 저장 버튼이 연속으로 눌려도 `PATCH`는 한 번에 하나다. `submitting`과 별도로 함수 큐를 두면 순서만 보장한다. 서버 작업자 프로세스나 메시지 브로커를 Alpine 안에 만들지 않는다.
- **측정**: `performance.now()`로 `load` 전후를 재고, 개발 중에만 콘솔에 밀리초와 경로를 남긴다. Performance 패널의 네트워크 막대와 숫자를 대조한다.
- **`$nextTick`**: 목록을 바꾼 직후 DOM이 갱신된 다음에 첫 항목으로 스크롤할 때 쓴다. 데이터를 기다릴 때는 `await load()`이지 `$nextTick`이 아니다.
- **서버 캐시**: 응답의 `ETag`가 있으면 다음 요청에 `If-None-Match`를 실어 `304`를 받을 수 있다. `304`는 본문이 비어 있으므로 기존 `posts`를 유지한다. 이 최적화를 모든 API가 한다고 가정하지 않는다.

### 비유

검색은 엘리베이터 버튼을 연타하는 일과 같다. 마지막 층만 남기고 앞선 호출은 취소한다. 30초 캐시는 방금 받은 안내문을 다시 복사하지 않는 일이다.

## ③ 🛠️ 실기

```javascript
function createSearch(loadPage) {
  let timer = 0
  let controller = null
  const cache = new Map()
  return {
    cache,
    schedule(query) {
      clearTimeout(timer)
      timer = setTimeout(() => this.run(query), 300)
    },
    async run(query) {
      const key = JSON.stringify(query)
      const hit = cache.get(key)
      if (hit && Date.now() - hit.at < 30000) return hit.value
      if (controller) controller.abort()
      controller = new AbortController()
      const started = performance.now()
      try {
        const value = await loadPage(query, controller.signal)
        cache.set(key, { at: Date.now(), value })
        console.info('posts', Math.round(performance.now() - started))
        return value
      } catch (error) {
        if (error.name === 'AbortError') return null
        throw error
      }
    },
    drop(key) { cache.delete(key) }
  }
}
```

`api()`에 `signal`을 넘긴다.

```javascript
const response = await fetch(apiBase() + path, { ...options, headers, signal: options.signal })
```

컴포넌트:

```javascript
async load(query) {
  const result = await this.search.run(query)
  if (!result) return
  this.posts = result.data
  this.meta = result.meta
  await this.$nextTick()
}
```

한 줄 큐:

```javascript
function createQueue() {
  let pending = Promise.resolve()
  return function enqueue(job) {
    pending = pending.then(job, job)
    return pending
  }
}
```

`enqueue`에 넘긴 `PATCH`는 이전 작업이 끝난 뒤에 시작한다. 실패해도 다음 작업이 멈추지 않도록 두 번째 인자에도 `job`을 둔다. 작업 함수 스스로 오류를 화면에 남긴다.

### 줄별 설명

1. `schedule`은 300ms 타이머를 매번 리셋한다.
2. 캐시 키는 쿼리 객체의 JSON이다. 객체 참조가 아니라 내용이 같으면 같은 키여야 한다.
3. 30초를 넘기면 네트워크로 간다.
4. 새 실행이 이전 `AbortController`를 중단한다.
5. `performance.now()` 차이를 정수 밀리초로만 로그한다. 응답 본문은 로그하지 않는다.
6. `AbortError`는 `null`을 돌려 화면이 이전 목록을 유지하게 한다.
7. `fetch`의 `signal`이 취소와 연결되는 지점이다.
8. `$nextTick`은 `posts` 대입 다음에 DOM이 따라온 뒤다.
9. 큐는 작업 프라미스를 한 줄로 잇는다. 병렬 제한 서버가 아니다.

## ④ 🔗 연동 포인트

쓰기 성공(`POST` `PATCH` `DELETE`) 직후 `search.drop`으로 해당 목록 키를 지우거나 `cache.clear()`를 호출한 다음 `load`한다. 안 그러면 30초 동안 삭제한 글이 목록에 남는다. 캐시는 브라우저 메모리라 다른 사용자와 공유되지 않는다. study16의 서버 로그와 비교할 때는 콘솔의 밀리초가 아니라 Network의 대기 시간과 `X-Request-Id`를 사용한다. 백그라운드라고 해서 탭이 닫힌 뒤에도 도는 작업을 Alpine에 만들지 않는다. 탭이 살아 있는 동안의 큐만 있다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 이전 검색어의 결과가 보임 | 느린 응답이 나중에 덮어씀 | `AbortController`로 이전 요청을 취소한다 |
| 취소가 빨간 오류로 표시 | `AbortError`를 일반 실패로 처리 | 이름을 비교해 메시지를 비운다 |
| 삭제한 글이 남음 | 30초 캐시 | 쓰기 성공 후 해당 키를 지운다 |
| 캐시에 토큰이 보임 | 캐시 값에 헤더를 저장 | `data`와 `meta`만 저장한다 |
| `$nextTick` 뒤에 데이터가 없음 | 네트워크 완료 전에 호출 | `await load` 다음에 `$nextTick` |
| 큐가 첫 실패에서 정지 | `then(job)`만 사용 | 실패 콜백에도 다음 `job`을 연결하고, `job` 안에서 오류를 표시한다 |
| 304 후 목록이 비음 | 빈 본문을 `data`로 사용 | 304면 기존 `posts`를 유지한다 |

## ⑥ 직접 해보기

1. 검색어를 빠르게 다섯 글자 입력하고 Network에 요청이 한 번인지 본다.
2. 같은 검색을 10초 안에 다시 실행해 콘솔 시간이 더 짧은지, 30초 뒤에 다시 요청이 나가는지 본다.
3. 삭제 뒤에 캐시를 지우지 않은 경우와 지운 경우의 목록 차이를 새로고침 없이 비교한다.

## ⑦ ☐ 체크리스트

- [ ] 입력 디바운스가 300ms다
- [ ] 이전 목록 요청을 `AbortController`로 취소한다
- [ ] 캐시는 30초, 키는 쿼리, 값은 `data`/`meta`뿐이다
- [ ] 쓰기 성공 후 관련 캐시를 지운다
- [ ] 연속 수정은 큐 한 줄로 이어진다
- [ ] 측정 로그에 본문·토큰이 없다
- [ ] `$nextTick`을 데이터 로딩의 대체로 쓰지 않는다

## ⑧ 다음 단계

study16에서 이 정적 페이지를 이미지로 올리고, 배포 워크플로·로그·백업을 점검표로 확인한다.
