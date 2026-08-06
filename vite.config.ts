import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Multi-entry build for MeuPlayer multi-page shells.
 * Output lands in public/js so the Go static server keeps serving public/.
 */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  build: {
    outDir: 'public/js',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        nav: resolve(__dirname, 'src/nav.ts'),
        player: resolve(__dirname, 'src/player.ts'),
        'provider-modal': resolve(__dirname, 'src/provider-modal.ts'),
        'spatial-nav': resolve(__dirname, 'src/spatial-nav.ts'),
        'rede-buzz-store': resolve(__dirname, 'src/rede-buzz-store.ts'),
        'rede-buzz-ui': resolve(__dirname, 'src/rede-buzz-ui.ts'),
        app: resolve(__dirname, 'src/app/main.tsx'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8765',
    },
  },
});
