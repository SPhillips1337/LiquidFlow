import { defineConfig } from 'vite'
import { exec } from 'child_process'
import { unlinkSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  server: { 
    port: 5173,
    proxy: {
      '/api/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        secure: false,
        proxyTimeout: 60000,
        timeout: 60000,
        rewrite: (path) => path.replace(/^\/api\/ollama/, '/api/generate')
      }
    }
  },
  plugins: [
    {
      name: 'book-management',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/manage/')) {
            const url = new URL(req.url, `http://${req.headers.host}`)
            const id = url.searchParams.get('id')
            
            if (req.url.includes('/regenerate') && id) {
              console.log(`[Management] Regenerating book: ${id}`)
              const pipelinePath = join(process.cwd(), '../pipeline')
              exec(`npm run ingest -- ${id}`, { cwd: pipelinePath }, (err, stdout, stderr) => {
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
})
