import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.17.5/dist/module.esm.js'
import persist from 'https://cdn.jsdelivr.net/npm/@alpinejs/persist@3.17.5/dist/module.esm.js'
import collapse from 'https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.17.5/dist/module.esm.js'
import focus from 'https://cdn.jsdelivr.net/npm/@alpinejs/focus@3.17.5/dist/module.esm.js'
import { registerBoard } from './board.mjs'
import { registerFinal } from './final.mjs'

window.__CONFIG = window.__CONFIG || { apiBase: '' }
Alpine.plugin(persist)
Alpine.plugin(collapse)
Alpine.plugin(focus)
window.Alpine = Alpine
registerBoard(Alpine)
registerFinal(Alpine)
Alpine.start()
