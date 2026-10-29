import { defineConfig } from 'vite';

/**
 * 构建配置
 * - base 使用相对路径：Electron(file://)、Capacitor(https://localhost) 与静态托管都能直接运行
 * - worker 使用 ES module 格式，由 Vite 打包为独立文件
 */
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: false
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: []
        }
      }
    }
  },
  worker: {
    format: 'es'
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.0.0')
  }
});
