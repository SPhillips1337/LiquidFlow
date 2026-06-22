import { defineConfig, loadEnv } from 'vite'
import { exec, execFile } from 'child_process'
import { unlinkSync, readdirSync } from 'fs'
import { join } from 'path'

const GUTENDEX_URL = 'https://gutendex.com'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, join(process.cwd(), '..'), '')
  const ollamaBase = env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'

  return {
    server: { 
      port: 5173,
      proxy: {
        '/api/ollama': {
          target: ollamaBase,
          changeOrigin: true,
          secure: false,
          proxyTimeout: 60000,
          timeout: 60000,
          rewrite: (path) => path.replace(/^\/api\/ollama/, '')
        }
      }
    },
  plugins: [
    {
      name: 'book-management',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url || '', `http://${req.headers.host}`)

          // ── Search books via Gutendex ──
          if (req.url?.startsWith('/api/books/search')) {
            const query = url.searchParams.get('q') || ''
            const topic = url.searchParams.get('topic') || ''
            const page = url.searchParams.get('page') || '1'

            let gutendexUrl = `${GUTENDEX_URL}/books?page=${page}`
            if (query) gutendexUrl += `&search=${encodeURIComponent(query)}`
            if (topic) gutendexUrl += `&topic=${encodeURIComponent(topic)}`

            try {
              const resp = await fetch(gutendexUrl)
              if (!resp.ok) throw new Error(`Gutendex error: ${resp.status}`)
              const data = await resp.json()
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
            } catch (e: any) {
              res.statusCode = 502
              res.end(JSON.stringify({ error: e.message }))
            }
            return
          }

          // ── Create story from premise (Ollama) ──
          if (req.url?.startsWith('/api/books/create-story') && req.method === 'POST') {
            let body = ''
            req.on('data', (chunk: string) => (body += chunk))
            req.on('end', () => {
              try {
                const { premise, genre } = JSON.parse(body)
                if (!premise?.trim()) {
                  res.statusCode = 400
                  res.end(JSON.stringify({ error: 'Missing premise' }))
                  return
                }
                const normalizedPremise = premise.replace(/\s+/g, ' ').trim()
                const normalizedGenre = String(genre || 'Fiction').replace(/\s+/g, ' ').trim()
                console.log(`[CreateStory] Starting: ${normalizedPremise.slice(0, 80)}…`)
                const pipelinePath = join(process.cwd(), '../pipeline')
                execFile(
                  'npm',
                  ['run', 'create-story', '--', normalizedPremise, normalizedGenre],
                  { cwd: pipelinePath, timeout: 900000, maxBuffer: 20 * 1024 * 1024 },
                  (err, stdout, stderr) => {
                    if (err) {
                      console.error(`[CreateStory] Failed: ${err.message}`)
                      res.statusCode = 500
                      res.end(JSON.stringify({ error: err.message, stderr: stderr?.slice(-2000) }))
                    } else {
                      console.log(`[CreateStory] Success:\n${stdout}`)
                      res.setHeader('Content-Type', 'application/json')
                      res.end(JSON.stringify({ success: true, log: stdout.slice(-1500) }))
                    }
                  }
                )
              } catch (e: any) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: e.message }))
              }
            })
            return
          }

          // ── Ingest a new book ──
          if (req.url?.startsWith('/api/books/ingest') && req.method === 'POST') {
            let body = ''
            req.on('data', (chunk: string) => body += chunk)
            req.on('end', () => {
              try {
                const { id, url: bookUrl, title, author, emoji } = JSON.parse(body)
                if (!id || !bookUrl || !title || !author) {
                  res.statusCode = 400
                  res.end('Missing required fields: id, url, title, author')
                  return
                }
                console.log(`[Ingest] Starting: ${title} by ${author}`)
                const pipelinePath = join(process.cwd(), '../pipeline')
                const safeTitle = title.replace(/"/g, '\\"')
                const safeAuthor = author.replace(/"/g, '\\"')
                const safeEmoji = emoji || '📖'
                exec(
                  `npm run ingest -- ${id} "${bookUrl}" "${safeTitle}" "${safeAuthor}" "${safeEmoji}"`,
                  { cwd: pipelinePath, shell: true, timeout: 600000, maxBuffer: 10 * 1024 * 1024 },
                  (err, stdout, stderr) => {
                    if (err) {
                      console.error(`[Ingest] Failed: ${err.message}`)
                      res.statusCode = 500
                      res.end(JSON.stringify({ error: err.message, stderr }))
                    } else {
                      console.log(`[Ingest] Success:\n${stdout}`)
                      res.end(JSON.stringify({ success: true }))
                    }
                  }
                )
              } catch (e: any) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: e.message }))
              }
            })
            return
          }

          // ── List available manifests ──
          if (req.url === '/api/books/list') {
            const booksDir = join(process.cwd(), 'public/books')
            try {
              const files = readdirSync(booksDir).filter(f => f.endsWith('.manifest.json'))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ manifests: files }))
            } catch {
              res.end(JSON.stringify({ manifests: [] }))
            }
            return
          }

          // ── Manage existing books ──
          if (req.url?.startsWith('/api/manage/')) {
            const id = url.searchParams.get('id')
            
            if (req.url.includes('/regenerate') && id) {
              console.log(`[Management] Regenerating book: ${id}`)
              const pipelinePath = join(process.cwd(), '../pipeline')
              exec(`npm run ingest -- ${id}`, { cwd: pipelinePath, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                  console.error(err)
                  res.statusCode = 500
                  res.end('Regeneration failed')
                } else {
                  console.log(stdout)
                  res.end('Success')
                }
              })
              return
            }

            if (req.url.includes('/delete') && id) {
              console.log(`[Management] Deleting book: ${id}`)
              try {
                const path = join(process.cwd(), `public/books/${id}.manifest.json`)
                unlinkSync(path)
                res.end('Deleted')
              } catch (e) {
                res.statusCode = 500
                res.end('Delete failed')
              }
              return
            }
          }
          next()
        })
      }
    }
  ],
  build: { target: 'es2022' }
  }
})
