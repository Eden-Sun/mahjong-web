import { defineConfig } from 'vite'

export default defineConfig({
  base: '/mahjong-web/',
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    host: '0.0.0.0',
    // 確保 public 文件直接被服務（不加 public 前綴）
    middlewareMode: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // WASM 文件處理
    rollupOptions: {
      output: {
        // 確保 WASM 不被變換
      }
    }
  },
  // 確保 .wasm 文件被正確識別
  assetsInclude: ['**/*.wasm'],
})
