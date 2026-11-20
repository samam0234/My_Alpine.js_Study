# study18. AI 연동·MCP

## ① 목표

Alpine 화면에서 문서 발췌만 근거로 답하게 하고, 스트리밍 응답을 텍스트로 이어 붙이며, MCP 도구 이름은 게시판 검색 하나로 이해한다.

## ② 📖 이론

### 왜 쓰는지

[DocuForge](https://app.notion.com/p/40bd7dec5e2e818d9c91c6fb26dccc4c)는 문서를 올리면 요약하고, 고른 발췌만 근거로 질문에 답하며, 근거가 없으면 찾지 못했다고 말한다. 이 장의 미니 예제는 그 아이디어만 Alpine 페이지에 옮긴다. 모델 API 키는 서버 환경 변수에만 둔다. 브라우저의 `config.js`에는 `API_BASE`만 있다.

붙이는 방향은 두 가지다.

| 방향 | Alpine이 하는 일 |
| --- | --- |
| 서비스가 모델을 부른다 | `POST /api/ai/chat` 또는 `/api/ai/chat/stream`을 Bearer와 함께 호출하고 글자를 화면에 쌓는다 |
| AI 앱이 서비스를 부른다 | Alpine이 MCP 서버 프로세스가 되지는 않는다. 도구 이름 `search_posts`와 인자 `{ q }`만 화면의 검색과 같은 의미로 둔다 |

모델 호출의 인증은 사용자 JWT(또는 스펙의 `accessToken`)이고, 모델 제공자 키와는 다른 비밀이다. 키를 브라우저에 넣는 코드는 이 문서의 예제가 아니다.

### 핵심 개념

- **프롬프트**: 시스템 문장은 "발췌에 있는 내용만 답한다. 근거는 `(발췌 N)`으로 표시한다. 발췌에 없으면 `찾을 수 없습니다`라고만 답한다."로 고정한다. 사용자가 그 문장을 지우는 입력칸을 만들지 않는다.
- **발췌**: 문서 텍스트를 빈 줄 기준으로 나누고, 질문에 포함된 단어가 있는 조각만 최대 3개 고른다. 이 선택은 키가 없을 때의 로컬 동작이다. DocuForge의 청크 검색과 같은 목적(근거 밖 답변 금지)이고, 임베딩 서버를 이 페이지에 두지 않는다.
- **스트리밍**: `EventSource`는 GET만 되고 `Authorization`을 못 붙인다. `fetch`와 `response.body.getReader()`로 `text/event-stream`의 `data: {"text":"..."}` 줄을 읽는다. 끝은 `data: [DONE]`이다.
- **렌더**: 누적 문자열을 `x-text`로만 보여 준다.
- **한도**: 입력은 2000자, 대화 배열은 최근 20개, 화면은 서버가 `429`와 `error.code === 'AI_QUOTA_EXCEEDED'`를 주면 그 `message`만 보여 준다. 토큰 원장은 브라우저 변수가 아니라 서버 DB다.
- **도구**: 로컬 연습은 `search_posts`가 이미 받아 둔 `posts` 제목만 거른다. 남의 비공개 글을 읽는 도구는 만들지 않는다. 모델 응답 문자열을 `eval`이나 주소 이동에 쓰지 않는다.
- **MCP 용어**: Host는 AI 앱, Client는 Host 안의 연결, Server는 도구를 제공하는 별도 프로세스, Tools는 `search_posts`, Resources는 `board://posts/{id}` 같은 읽기 이름, Prompts는 위 시스템 문장, Transport는 로컬 stdio 또는 원격 HTTP다. 원격 도구는 인증이 필요하다. 이 HTML 파일이 그 서버를 대신 열지 않는다.
- **거부**: 스트림 JSON에 `error`가 있거나 최종 메타의 `stopReason`이 `refusal`이면 누적 글을 지우고 "이 요청에는 답할 수 없습니다."를 보여 준다.

### 비유

발췌 더미가 아니면 답하지 않는 규칙은, 서가에 없는 책을 인용하지 않는 일과 같다. 열쇠(모델 키)는 서가 데스크 안에 있고 열람증(사용자 토큰)만 창구로 나간다.

## ③ 🛠️ 실기

```html
<div x-data="docAsk" x-init="loadPosts()">
  <textarea x-model="documentText" maxlength="8000" placeholder="TXT 본문"></textarea>
  <input x-model.trim="question" maxlength="2000">
  <button type="button" @click="ask()" :disabled="busy || !question">질문</button>
  <pre x-text="answer"></pre>
  <ol>
    <template x-for="(chunk, index) in used" :key="index">
      <li x-text="chunk"></li>
    </template>
  </ol>
</div>
```

```javascript
function excerpts(documentText, question) {
  const words = question.toLowerCase().split(/\s+/).filter((word) => word.length > 1)
  return documentText.split(/\n\n+/).map((text) => text.trim()).filter(Boolean).filter((text) => {
    const lower = text.toLowerCase()
    return words.some((word) => lower.includes(word))
  }).slice(0, 3)
}

function answerFromExcerpts(chunks) {
  if (!chunks.length) return '찾을 수 없습니다'
  return chunks.map((text, index) => text + ' (발췌 ' + (index + 1) + ')').join('\n')
}

Alpine.data('docAsk', () => ({
  documentText: '',
  question: '',
  answer: '',
  used: [],
  posts: [],
  busy: false,
  async loadPosts() {
    try {
      const result = await api('/api/posts?page=1&limit=10&sort=-createdAt')
      this.posts = result.data || []
    } catch { this.posts = [] }
  },
  searchPosts(q) {
    const query = String(q || '').toLowerCase()
    return this.posts.filter((post) => String(post.title || '').toLowerCase().includes(query)).slice(0, 10)
      .map((post) => ({ id: post.id, title: post.title }))
  },
  async ask() {
    if (this.busy) return
    if (this.question.length < 1 || this.question.length > 2000) return
    this.busy = true
    this.answer = ''
    this.used = excerpts(this.documentText, this.question)
    try {
      if (!window.__CONFIG?.aiStream) {
        this.answer = answerFromExcerpts(this.used)
        return
      }
      await this.stream()
    } catch (error) {
      this.answer = error.message || '잠시 후 다시 시도해 주세요'
    } finally {
      this.busy = false
    }
  },
  async stream() {
    const messages = [{ role: 'user', content: this.question }].slice(-20)
    const response = await fetch(apiBase() + '/api/ai/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'text/event-stream',
        'Authorization': 'Bearer ' + (Alpine.store('auth').token || '')
      },
      body: JSON.stringify({
        messages,
        excerpts: this.used.map((text, index) => ({ n: index + 1, text }))
      })
    })
    if (response.status === 401) throw new Error('로그인이 필요합니다.')
    if (response.status === 429) throw new Error('오늘 사용 한도에 도달했습니다.')
    if (!response.ok || !response.body) throw new Error('잠시 후 다시 시도해 주세요')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const step = await reader.read()
      if (step.done) break
      buffer += decoder.decode(step.value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const line = part.split('\n').find((item) => item.startsWith('data: '))
        if (!line) continue
        const data = line.slice(6)
        if (data === '[DONE]') return
        const json = JSON.parse(data)
        if (json.error) throw new Error(json.error.message || '잠시 후 다시 시도해 주세요')
        if (json.stopReason === 'refusal') { this.answer = '이 요청에는 답할 수 없습니다.'; return }
        if (json.text) this.answer += json.text
      }
    }
  }
}))
```

`window.__CONFIG.aiStream`의 기본값은 없다. 그래서 예제는 모델 키 없이 발췌 인용만 한다. 스트리밍을 켤 때는 같은 원점의 프록시가 키를 갖고 있어야 하며, 그 프록시를 이 저장소의 스크립트로 포함하지 않는다. `Alpine.data('docAsk', ...)` 등록은 `alpine:init` 안에서 한다.

로컬 도구 호출은 컴포넌트의 `searchPosts('안녕')`다. 반환은 `{ id, title }` 배열이며 본문 전체를 도구 결과에 넣지 않는다.

### 줄별 설명

1. `excerpts`는 질문 단어가 들어간 문단만 최대 3개 고른다.
2. 문단이 없으면 `찾을 수 없습니다`다. DocuForge가 발췌에 없을 때 쓰는 말과 같다.
3. 있으면 각 문단 끝에 `(발췌 N)`을 붙인다.
4. `aiStream`이 없으면 네트워크로 모델에 나가지 않는다.
5. `stream`의 `messages`는 최근 20개로 자른다. 예제는 이번 질문 하나다.
6. `Authorization`은 `auth` 스토어의 메모리 토큰이다. 모델 키가 아니다.
7. 본문의 `excerpts`는 서버가 시스템 프롬프트에 넣을 근거다. 서버는 이 배열 밖의 지식을 답에 쓰지 않도록 프롬프트를 고정한다.
8. `401`과 `429`는 스트림을 읽기 전에 끝낸다.
9. 리더는 `\n\n` 단위로 이벤트를 나눈다. 덜 온 조각은 `buffer`에 남긴다.
10. `[DONE]`에서 종료한다.
11. `json.text`만 누적한다. HTML로 해석하지 않는다.
12. `searchPosts`는 이미 공개 목록으로 받아 둔 제목만 거른다.

## ④ 🔗 연동 포인트

DocuForge의 흐름은 업로드 → 요약 → 질문 → 근거 발췌다. Alpine 미니 예제는 TXT 본문 붙여넣기 → 로컬 발췌 → `(발췌 N)` 답으로 그 흐름의 화면 쪽을 재현한다. 스트리밍을 켤 때의 경로는 `POST /api/ai/chat/stream`이고 성공 조각은 `{ text }`, 실패는 `{ error: { code, message } }`다. 사용자별 토큰 합계와 일일 한도는 서버가 요청 전에 본다. Ollama를 같은 경로에 붙이는 선택은 서버 환경 변수이며 Alpine은 제공자 이름을 몰라도 같은 리더 코드를 쓴다. MCP 서버를 Claude 앱이나 Claude Code에 연결하는 작업은 별도 프로세스가 `search_posts`를 제공할 때의 일이다. 그 프로세스의 결과 모양을 이 컴포넌트의 `searchPosts` 반환과 같게 유지하면 화면의 도구 표와 이름이 맞는다. 게시판 id로 들어갈 때는 도구 결과가 아니라 `GET /api/posts/{id}`를 쓴다.

## ⑤ 오류 노트

| 증상 | 원인 | 해결 |
| --- | --- | --- |
| 키를 넣자마자 저장소에 보임 | `config.js`에 모델 키 추가 | 그 줄을 지우고 키를 폐기한다. `API_BASE`만 남긴다 |
| 답에 태그가 실행됨 | `x-html`로 모델 출력 | `x-text` 또는 `pre x-text`만 쓴다 |
| 스트림이 한 번에 안 보임 | 줄 단위가 아니라 글자 단위로 JSON을 파싱 | `\n\n`으로 나눈 완전한 이벤트만 `JSON.parse` 한다 |
| 이전 검색이 계속 이어짐 | `busy` 없이 재진입 | `ask` 시작 시 return 하고 버튼을 비활성화한다 |
| 발췌가 없는데 일반 상식으로 답함 | 로컬 함수를 끄고 제약이 없는 프롬프트를 호출 | 기본 경로는 `answerFromExcerpts`다. 서버 프롬프트도 발췌 밖이면 `찾을 수 없습니다`로 고정한다 |
| 도구가 글 전체를 반환 | `searchPosts`가 `body`를 포함 | `id`와 `title`만 반환한다 |
| `EventSource`에 토큰을 못 넣음 | GET 전용 API | `fetch` 스트림을 쓴다 |

## ⑥ 직접 해보기

1. 본문에 질문 단어가 없을 때 답이 `찾을 수 없습니다`인지 본다.
2. 본문을 두 문단으로 나누고 한 문단에만 단어가 있을 때 `(발췌 1)` 한 줄만 나오는지 본다.
3. `searchPosts`에 목록에 없는 단어를 넣어 빈 배열인지 확인하고, 반환 객체에 `body` 키가 없는지 본다.

## ⑦ ☐ 체크리스트

- [ ] API 키를 서버 환경 변수로만 다루고, 브라우저에는 절대 노출하지 않기
- [ ] JWT로 보호된 `POST /api/ai/chat` 만들기 (공통 스펙 응답 형식)
- [ ] 스트리밍(SSE)으로 글자가 흘러나오게 하기 + 프론트에서 받기
- [ ] 대화 기록·토큰 사용량을 DB에 저장하고 사용자별 한도 걸기
- [ ] 도구 호출(tool use)로 모델이 내 게시판 검색 함수를 쓰게 하기
- [ ] Ollama로 오픈 모델을 로컬에 띄워 같은 엔드포인트에 연결해 보기
- [ ] 내 게시판을 MCP 서버로 만들고 Claude 앱 / Claude Code에 연결하기
- [ ] 프롬프트 인젝션·비용 폭주·키 유출 점검
- [ ] API 키는 서버 환경 변수에만, 프론트 번들·Git·로그에 없음
- [ ] `/api/ai/*` 는 JWT 필수, 사용자별 일일 토큰 한도 + 요청 속도 제한(rate limit)
- [ ] `max_tokens`, 대화 길이, 입력 글자 수 상한
- [ ] 모델 출력은 텍스트로 렌더링 (XSS 방지, 웹 보안 기초 페이지)
- [ ] 프롬프트 인젝션: 게시글·도구 결과 안의 "이전 지시를 무시해" 같은 문장이 모델을 조종할 수 있다 → 도구 권한을 최소로, 민감한 작업은 서버에서 다시 권한 확인
- [ ] 모델 응답을 그대로 SQL·셸 명령으로 실행하지 않기
- [ ] 응답의 `stop_reason` 확인 (`refusal`, `max_tokens` 처리)
- [ ] 사용량·비용을 DB와 공급자 콘솔에서 주기적으로 확인
- [ ] 개인정보를 모델에 보내기 전에 꼭 필요한지 확인
- [ ] 키 없을 때는 발췌 인용만 하고 `(발췌 N)` 또는 `찾을 수 없습니다`만 나온다
- [ ] `search_posts` 결과는 공개 목록의 `id`와 `title`뿐이다
- [ ] DocuForge의 업로드·요약·근거 답변 흐름 중 화면에서 재현한 범위가 TXT 발췌 질문이다

JWT 검증, 토큰 원장, Ollama 프로세스, MCP 프로세스 실행은 Alpine 파일 밖에서 같은 경로와 도구 이름을 지켜야 한다. 이 체크리스트는 그 계약을 빼먹지 않기 위한 항목이다.

## ⑧ 다음 단계

studyfinal에서 게시판, 저장 어댑터, 업로드·결제 시작, 발췌 질문, 컨테이너 배포를 한 서비스 순서로 다시 묶는다.
