import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ['**/config/**', '**/server.js'],
    },
    proxy: {
      '/api/modelscope': {
        target: 'https://api-inference.modelscope.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/modelscope/, ''),
      },
      '/api/siliconflow': {
        target: 'https://api.siliconflow.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/siliconflow/, ''),
      },
      '/api/aliyun': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/aliyun/, ''),
      },
      '/api/thirdparty1': {
        target: 'https://ai.t8star.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/thirdparty1/, ''),
      },
      '/api/thirdparty2': {
        target: 'http://api.0005566.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/thirdparty2/, ''),
      },
      '/api/bizyair': {
        target: 'https://api.bizyair.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bizyair/, ''),
      },
      '/api/volcengine': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/volcengine/, ''),
      },

      '/api/config': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/save': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/history': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/open-folder': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/output': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/upload': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
