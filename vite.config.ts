import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    watch: {
      ignored: ['**/*.zip', '**/*.exe', '**/takeout_json/**', '**/*.mjs'],
    },
  },
  build: {
    target: 'esnext',
    minify: false,
  },
});
