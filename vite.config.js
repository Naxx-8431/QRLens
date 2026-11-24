import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // The scanner engine is loaded on demand. Pre-bundling it stops the dev
  // server from reloading the page the first time the camera is opened.
  optimizeDeps: {
    include: ['barcode-detector/ponyfill'],
  },
  // The decoder worker loads its engine on demand, which needs ES module output.
  worker: {
    format: 'es',
  },
})
