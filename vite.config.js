import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    https: fs.existsSync('.cert/key.pem') && fs.existsSync('.cert/cert.pem') ? {
      key: fs.readFileSync('.cert/key.pem'),
      cert: fs.readFileSync('.cert/cert.pem'),
    } : false
  }
})
