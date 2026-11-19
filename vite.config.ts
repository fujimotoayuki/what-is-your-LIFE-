import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// No API keys live on a server or in this repo.
// Each user enters their own Gemini API key in the app (stored only in their browser).
export default defineConfig({
  plugins: [tailwindcss()],
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    watch: {
      ignored: ['**/*.zip', '**/*.exe', '**/takeout_json/**', '**/*.mjs', '**/video/**'],
    },
  },
  build: {
    target: 'esnext',
    minify: false,
  },
});
