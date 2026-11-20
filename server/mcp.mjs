import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { createStore, publicPost } from './store.mjs'

const protocol = '2024-11-05'

function searchPosts(db, q, limit) {
  const query = String(q || '').toLowerCase()
  const size = Math.min(20, Math.max(1, Number(limit) || 10))
  return db.posts
    .filter((post) => post.title.toLowerCase().includes(query) || post.body.toLowerCase().includes(query))
    .slice(0, size)
    .map((post) => {
      const view = publicPost(db, post)
      return { id: view.id, title: view.title }
    })
}

export function handleMcp(message, db) {
  if (message.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: protocol,
        capabilities: { tools: {} },
        serverInfo: { name: 'board', version: '1.0.0' }
      }
    }
  }
  if (message.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          {
            name: 'search_posts',
            description: '게시판 글을 제목·내용으로 검색한다. id와 title만 반환한다.',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string' },
                limit: { type: 'number' }
              },
              required: ['q']
            }
          }
        ]
      }
    }
  }
  if (message.method === 'tools/call' && message.params?.name === 'search_posts') {
    const rows = searchPosts(db, message.params.arguments?.q, message.params.arguments?.limit)
    return {
      jsonrpc: '2.0',
      id: message.id,
      result: { content: [{ type: 'text', text: JSON.stringify(rows) }] }
    }
  }
  if (message.id === undefined) return null
  return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: '없는 메서드입니다.' } }
}

async function main() {
  const file = process.env.DATA_FILE || fileURLToPath(new URL('../data/db.json', import.meta.url))
  const store = createStore(file)
  await store.load()
  const input = createInterface({ input: process.stdin })
  input.on('line', (line) => {
    if (!line.trim()) return
    let message
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    const response = store.read((db) => handleMcp(message, db))
    if (response) process.stdout.write(JSON.stringify(response) + '\n')
  })
}

if (process.argv[1] && process.argv[1].endsWith('mcp.mjs')) {
  main()
}
