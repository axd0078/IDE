import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: false,  // dev 阶段跳过压缩，减少构建时间
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: false,
    },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
      },
    },
    plugins: [react()],
    server: {
      warmup: {
        clientFiles: ['./src/main.tsx'],  // 启动时预编译入口
      },
    },
  },
});
