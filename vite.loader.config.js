import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

/*
 * The loader — the file sites paste. Built second, because it has to know the
 * hashed name of the bundle it loads; scripts/build-embed.mjs passes it in.
 */
export default defineConfig({
  define: {
    __PINGLY_BUNDLE__: JSON.stringify(process.env.PINGLY_BUNDLE || 'widget/pingly-chat.js'),
  },
  build: {
    outDir: 'dist-embed',
    // The bundle is already sitting there.
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/embed/loader.js', import.meta.url)),
      formats: ['iife'],
      name: 'PinglyChatLoader',
      fileName: () => 'widget.js',
    },
    // Older than the bundle on purpose: whatever the browser, this file should
    // be able to run far enough to say why nothing happened.
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: false,
  },
});
