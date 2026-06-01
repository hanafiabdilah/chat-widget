/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx}', './index.html'],
  // Preflight (Tailwind's CSS reset) is disabled — the widget is mounted
  // into pages we don't own, so normalizing the host's elements would be
  // hostile. Tailwind utility classes are universal CSS and won't
  // conflict if the host already uses Tailwind.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
