import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

// Library build for npm publishing. Emits both ESM and CJS so the host's
// bundler can pick the right one. React, react-dom, and lucide-react are
// peer dependencies — the host must already have them, and they MUST stay
// external to avoid React duplication (which would crash hooks).
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.jsx', import.meta.url)),
      formats: ['es', 'cjs'],
      // `chat-widget.mjs` / `chat-widget.cjs` — `exports` field in
      // package.json points the host's resolver at these.
      fileName: (format) => `chat-widget.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react'],
      output: {
        // Pin the CSS asset name so host can `import '@multichat/chat-widget/styles.css'`.
        assetFileNames: (asset) => (asset.name?.endsWith('.css') ? 'chat-widget.css' : asset.name),
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    target: 'es2020',
    // Don't blow away other files from the dist (e.g. types if we ever
    // add them) — Vite will still rewrite our own outputs each build.
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
});
