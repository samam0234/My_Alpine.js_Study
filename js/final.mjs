import { api, apiBase } from './api.mjs'
import { answerFromExcerpts, excerpts } from './pure.mjs'

export function registerFinal(Alpine) {
  Alpine.data('shell', () => ({
    theme: Alpine.$persist('light'),
    route: { name: 'list', query: {} },
    init() {
      const apply = () => {
        const raw = (location.hash || '#/posts').replace(/^#/, '')
        const path = raw.split('?')[0]
        if (path === '/ask') this.route = { name: 'ask' }
        else if (path === '/extras') this.route = { name: 'extras' }
        else if (path === '/posts' || path === '' || path === '/') this.route = { name: 'list' }
        else this.route = { name: 'notfound', path }
      }
      apply()
      window.addEventListener('hashchange', apply)
      api('/api/auth/me').then((result) => {
        Alpine.store('auth').setSession({ user: result.data })
      }).catch(() => {})
    }
  }))

  Alpine.data('liveBoard', () => ({
    posts: [],
    status: 'idle',
    socket: null,
    async init() {
      await this.load()
      this.connect()
    },
    async load() {
      const result = await api('/api/posts?page=1&limit=10&sort=-createdAt')
      this.posts = result.data
    },
    connect() {
      const base = apiBase() || location.origin
      const local = base.startsWith('http://127.0.0.1') || base.startsWith('http://localhost') || location.hostname === '127.0.0.1'
      if (!base.startsWith('https://') && !local) {
        this.status = 'off'
        return
      }
      const url = base.replace(/^http/, 'ws') + '/ws'
      this.socket = new WebSocket(url)
      this.socket.addEventListener('open', () => { this.status = 'on' })
      this.socket.addEventListener('message', (event) => {
        let payload = null
        try { payload = JSON.parse(event.data) } catch { return }
        if (!payload || payload.type !== 'post.created' || !payload.post?.id) return
        this.posts = [payload.post, ...this.posts.filter((item) => item.id !== payload.post.id)].slice(0, 10)
      })
      this.socket.addEventListener('close', () => { this.status = 'off' })
    },
    destroy() {
      if (this.socket) this.socket.close()
    }
  }))

  Alpine.data('docAsk', () => ({
    documentText: '',
    question: '',
    answer: '',
    used: [],
    busy: false,
    posts: [],
    async loadPosts() {
      try {
        const result = await api('/api/posts?page=1&limit=10&sort=-createdAt')
        this.posts = result.data || []
      } catch {
        this.posts = []
      }
    },
    searchPosts(q) {
      const query = String(q || '').toLowerCase()
      return this.posts.filter((post) => String(post.title || '').toLowerCase().includes(query)).slice(0, 10)
        .map((post) => ({ id: post.id, title: post.title }))
    },
    async ask() {
      if (this.busy || this.question.length < 1 || this.question.length > 2000) return
      this.busy = true
      this.answer = ''
      this.used = excerpts(this.documentText, this.question)
      try {
        if (!Alpine.store('auth').user) {
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
      const response = await fetch((apiBase() || '') + '/api/ai/chat/stream', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'text/event-stream',
          ...(Alpine.store('auth').token ? { Authorization: 'Bearer ' + Alpine.store('auth').token } : {}),
          ...(Alpine.store('auth').csrf ? { 'X-CSRF-Token': Alpine.store('auth').csrf } : {})
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: this.question }],
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
          if (json.stopReason === 'refusal') {
            this.answer = '이 요청에는 답할 수 없습니다.'
            return
          }
          if (json.text) this.answer += json.text
        }
      }
    }
  }))

  Alpine.data('extras', () => ({
    selected: null,
    busy: false,
    message: '',
    preview: '',
    async upload() {
      if (!this.selected || this.busy) return
      this.busy = true
      this.message = ''
      try {
        const body = new FormData()
        body.append('file', this.selected)
        const headers = { Accept: 'application/json' }
        if (Alpine.store('auth').token) headers.Authorization = 'Bearer ' + Alpine.store('auth').token
        if (Alpine.store('auth').csrf) headers['X-CSRF-Token'] = Alpine.store('auth').csrf
        const response = await fetch((apiBase() || '') + '/api/uploads', { method: 'POST', headers, body, credentials: 'include' })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) {
          this.message = json.error?.message || '업로드하지 못했습니다.'
          return
        }
        this.message = '받았음 id ' + json.data.id
        this.selected = null
      } finally {
        this.busy = false
      }
    },
    readFile(event) {
      const file = event.target.files && event.target.files[0]
      this.selected = file || null
      if (!file) return
      if (file.size > 1024 * 1024) {
        this.preview = '1MB 이하만 미리 봅니다.'
        this.selected = null
        return
      }
      const reader = new FileReader()
      reader.onload = () => { this.preview = String(reader.result || '').slice(0, 4000) }
      reader.onerror = () => { this.preview = '파일을 읽지 못했습니다.' }
      reader.readAsText(file)
    },
    async askMail() {
      this.busy = true
      try {
        await api('/api/notifications/email', { method: 'POST', body: JSON.stringify({ subject: '안내', text: '확인 메일' }) })
        this.message = '메일 요청을 접수했습니다.'
      } catch (error) {
        this.message = error.message
      } finally {
        this.busy = false
      }
    },
    async startCheckout() {
      this.busy = true
      try {
        const result = await api('/api/checkout', { method: 'POST', body: JSON.stringify({ purpose: 'study' }) })
        const url = String(result.data?.url || '')
        if (!url.startsWith('https://')) throw new Error('이동할 주소가 없습니다.')
        location.assign(url)
      } catch (error) {
        this.message = error.message
        this.busy = false
      }
    }
  }))
}
