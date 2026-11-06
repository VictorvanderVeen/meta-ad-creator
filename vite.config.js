import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import os from 'os'
import { publishToShowcase } from './showcase-pocketbase.js'

const inputDir = path.join(os.homedir(), 'Desktop/meta-ad-creator-input')

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'serve-input-folder',
      configureServer(server) {
        server.middlewares.use('/input', (req, res, next) => {
          const filePath = path.join(inputDir, decodeURIComponent(req.url))
          res.setHeader('Access-Control-Allow-Origin', '*')
          server.middlewares.handle(
            Object.assign(req, { url: '/@fs/' + filePath }),
            res,
            next
          )
        })
      },
    },
    // '' = all variables, not only VITE_*: these stay on the dev server, never reach the browser
    publishToShowcase(loadEnv(mode, process.cwd(), '')),
  ],
  server: {
    fs: {
      allow: ['.', inputDir],
    },
  },
}))
