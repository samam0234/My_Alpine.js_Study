import { api } from './api.mjs'
import { parseHash, postListPath, validatePost } from './pure.mjs'

export function registerBoard(Alpine) {
  Alpine.store('auth', {
    user: null,
    token: '',
    csrf: '',
    setSession(data) {
      this.user = data.user || null
      if (data.accessToken) this.token = data.accessToken
    },
    setCsrf(token) {
      if (token) this.csrf = token
    },
    clear() {
      this.user = null
      this.token = ''
      this.csrf = ''
    }
  })

  Alpine.store('httpCache', {
    map: new Map(),
    clear() {
      this.map.clear()
    }
  })

  Alpine.data('router', () => ({
    route: parseHash(location.hash),
    init() {
      if (!location.hash) location.hash = '#/posts'
      window.addEventListener('hashchange', () => {
        this.route = parseHash(location.hash)
      })
      this.restore()
    },
    async restore() {
      try {
        const result = await api('/api/auth/me')
        Alpine.store('auth').setSession({ user: result.data })
      } catch {
        /* 로그인 전이면 401이다. */
      }
    },
    async logout() {
      try {
        await api('/api/auth/logout', { method: 'POST' })
      } catch {
        /* 이미 만료된 세션도 화면에서는 비운다. */
      }
      Alpine.store('auth').clear()
      Alpine.store('httpCache').clear()
      location.hash = '#/posts'
    }
  }))

  Alpine.data('postList', () => ({
    posts: [],
    q: '',
    meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
    message: '',
    timer: 0,
    controller: null,
    async load(page = 1) {
      const query = { page, limit: 10, q: this.q.trim(), sort: '-createdAt' }
      const key = JSON.stringify(query)
      const hit = Alpine.store('httpCache').map.get(key)
      if (hit && Date.now() - hit.at < 30000) {
        this.posts = hit.value.data
        this.meta = hit.value.meta
        this.message = ''
        return
      }
      if (this.controller) this.controller.abort()
      this.controller = new AbortController()
      try {
        const result = await api(postListPath(query), { signal: this.controller.signal })
        this.posts = result.data
        this.meta = result.meta
        Alpine.store('httpCache').map.set(key, { at: Date.now(), value: result })
        this.message = ''
      } catch (error) {
        if (error.name === 'AbortError') return
        this.message = error.message
      }
    },
    schedule() {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.load(1), 300)
    }
  }))

  Alpine.data('postDetail', () => ({
    post: null,
    comments: [],
    comment: '',
    message: '',
    missing: false,
    async init() {
      await this.load()
    },
    id() {
      return (location.hash.match(/#\/posts\/(\d+)/) || [])[1] || ''
    },
    async load() {
      try {
        const result = await api('/api/posts/' + this.id())
        this.post = result.data
        const comments = await api('/api/posts/' + this.id() + '/comments')
        this.comments = comments.data
        this.missing = false
        this.message = ''
      } catch (error) {
        this.missing = error.status === 404
        this.message = error.message
      }
    },
    mine(authorId) {
      return Alpine.store('auth').user && Alpine.store('auth').user.id === authorId
    },
    async remove() {
      await api('/api/posts/' + this.post.id, { method: 'DELETE' })
      Alpine.store('httpCache').clear()
      location.hash = '#/posts'
    },
    async addComment() {
      try {
        await api('/api/posts/' + this.post.id + '/comments', {
          method: 'POST',
          body: JSON.stringify({ body: this.comment })
        })
        this.comment = ''
        await this.load()
      } catch (error) {
        this.message = error.info?.fields?.body?.[0] || error.message
      }
    },
    async removeComment(id) {
      await api('/api/comments/' + id, { method: 'DELETE' })
      await this.load()
    }
  }))

  Alpine.data('writer', () => ({
    form: { title: '', body: '' },
    errors: {},
    formError: '',
    submitting: false,
    editingId: null,
    async init() {
      const id = new URLSearchParams((location.hash.split('?')[1] || '')).get('id')
      if (!id) return
      const result = await api('/api/posts/' + id)
      this.editingId = result.data.id
      this.form = { title: result.data.title, body: result.data.body }
    },
    async submit() {
      if (this.submitting) return
      this.errors = validatePost(this.form)
      this.formError = ''
      if (Object.keys(this.errors).length) return
      this.submitting = true
      try {
        if (this.editingId) {
          await api('/api/posts/' + this.editingId, {
            method: 'PATCH',
            body: JSON.stringify({ title: this.form.title, body: this.form.body })
          })
          Alpine.store('httpCache').clear()
          location.hash = '#/posts/' + this.editingId
          return
        }
        const result = await api('/api/posts', {
          method: 'POST',
          body: JSON.stringify({ title: this.form.title, body: this.form.body, tags: [] })
        })
        Alpine.store('httpCache').clear()
        location.hash = '#/posts/' + result.data.id
      } catch (error) {
        if ((error.status === 400 || error.status === 422) && error.info?.fields) {
          this.errors = error.info.fields
          this.formError = error.info.message || ''
        } else {
          this.formError = error.message
        }
      } finally {
        this.submitting = false
      }
    }
  }))

  Alpine.data('loginForm', () => ({
    email: '',
    password: '',
    message: '',
    async login() {
      this.message = ''
      try {
        const result = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: this.email, password: this.password })
        })
        this.password = ''
        Alpine.store('auth').setSession(result.data)
        location.hash = '#/posts'
      } catch (error) {
        this.password = ''
        this.message = error.message
      }
    }
  }))

  Alpine.data('signupForm', () => ({
    email: '',
    nickname: '',
    password: '',
    message: '',
    async signup() {
      this.message = ''
      try {
        await api('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email: this.email, nickname: this.nickname, password: this.password })
        })
        this.password = ''
        location.hash = '#/login'
      } catch (error) {
        this.password = ''
        this.message = error.info?.fields ? Object.values(error.info.fields).flat()[0] : error.message
      }
    }
  }))
}
