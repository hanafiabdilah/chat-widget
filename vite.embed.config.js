import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { fileURLToPath } from 'url';

/*
 * The self-mounting build: one file, React included, for sites with no build
 * step. The npm build (vite.config.js) is the opposite in every way that
 * matters — it keeps React external and exports a component.
 *
 * Run it through scripts/build-embed.mjs, which also hashes the output and
 * writes the loader that points at it.
 */

/**
 * Tailwind writes spacing and type in `rem`, and `rem` resolves against the
 * page's <html>, not ours — shadow DOM does not isolate it. A site with
 * `html { font-size: 62.5% }` (an old but very much alive CSS habit) would
 * render the whole widget at 62.5% scale, and nothing on our side could tell.
 *
 * Fixed pixels are also the honest unit here: every size the templates
 * compute in JS is already px, so the two were only ever consistent on a page
 * that left the root font-size alone.
 *
 * The npm build keeps rem — there the host owns the page and its scale.
 */
const remToPx = {
  postcssPlugin: 'pingly-rem-to-px',
  Declaration(declaration) {
    if (declaration.value.indexOf('rem') === -1) return;
    declaration.value = declaration.value.replace(
      /(-?\d*\.?\d+)rem\b/g,
      (_match, number) => `${parseFloat(number) * 16}px`,
    );
  },
};

export default defineConfig({
  plugins: [react()],
  // React reads this at module scope; without it the bundle ships the
  // development build, warnings and all.
  define: { 'process.env.NODE_ENV': '"production"' },
  css: {
    // Declared inline because this build needs one plugin the other does not,
    // and Vite ignores postcss.config.js the moment this is set.
    postcss: { plugins: [tailwindcss(), autoprefixer(), remToPx] },
  },
  build: {
    outDir: 'dist-embed',
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/embed.jsx', import.meta.url)),
      formats: ['iife'],
      name: 'PinglyChatEmbed',
      fileName: () => 'pingly-chat.js',
    },
    // Runs on strangers' sites on strangers' browsers. es2019 covers Safari
    // 13, which is as far back as anything else in the stack goes.
    target: 'es2019',
    minify: 'esbuild',
    // No map: it would be a second request from every embedding site for a
    // file only we would ever open, and the source is public on GitHub.
    sourcemap: false,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
