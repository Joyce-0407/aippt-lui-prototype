import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 相对 base：可同时部署在 GitHub Pages 子路径（/repo/）与本地根路径
  base: './',
  plugins: [react()],
  server: { port: 5173, open: false },
});
