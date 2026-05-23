import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

// Copy assets folder to public for serving
const assetsDir = path.resolve(__dirname, 'assets')
const publicDir = path.resolve(__dirname, 'public')

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

if (fs.existsSync(assetsDir)) {
  fs.readdirSync(assetsDir).forEach(file => {
    const src = path.join(assetsDir, file)
    const dest = path.join(publicDir, file)
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest)
    }
  })
}

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
