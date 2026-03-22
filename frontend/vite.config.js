import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      // Dev-only: route /api/* requests to the Vercel serverless functions
      {
        name: 'api-dev-proxy',
        configureServer(server) {
          // Expose env vars as process.env so API routes can read them
          Object.assign(process.env, env)

          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api/')) return next()

            const route = req.url.replace('/api/', '').split('?')[0]

            try {
              // Dynamically import the matching serverless function using absolute path
              const path = await import('path')
              const absolutePath = path.resolve(process.cwd(), `api/${route}.js`)
              const mod = await import(`file://${absolutePath}`)

              // Parse JSON body for POST requests
              if (req.method === 'POST') {
                let body = ''
                for await (const chunk of req) body += chunk
                try {
                  req.body = body ? JSON.parse(body) : {}
                } catch (e) {
                  req.body = {}
                  console.warn(`API dev proxy warning [${route}]: Invalid JSON input -`, e.message)
                }
              }

              // Set up express-like helpers for the serverless function
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              };

              await mod.default(req, res)
            } catch (err) {
              console.error(`API dev proxy error [${route}]:`, err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Internal server error' }))
            }
          })
        },
      },
    ],
  }
})
