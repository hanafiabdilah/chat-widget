/*
 * Which colour scheme is the page we are sitting on using?
 *
 * The widget renders into a shadow root on sites we do not own, so it cannot
 * inherit a theme and cannot be styled by the host's CSS. It has to *look* and
 * decide — and the one signal everybody assumes is enough, the OS preference,
 * is wrong most of the time: a site with its own light/dark toggle sets a
 * class or an attribute, and a visitor who flips it to light on a dark machine
 * would otherwise get a black chat panel on a white page.
 *
 * So four signals, most specific first:
 *
 *   1. `data-theme` and friends on <html>  — the convention with a value.
 *   2. a `dark` / `light` class            — Tailwind, Bootstrap 4, many hand-rolled togglers.
 *   3. the CSS `color-scheme` property     — what the page told the *browser*.
 *   4. `prefers-color-scheme`              — the OS, when the page said nothing.
 *
 * All four are re-read whenever the page changes its mind, which is the part
 * that matters: a visitor toggling the site's own theme switch sees the widget
 * follow, with no work asked of the embedding site.
 */
import { useEffect, useState } from 'react';

// Attributes carrying an explicit value. Ordered by how widely each is used,
// which is also roughly how much it can be trusted when several are present.
const SCHEME_ATTRIBUTES = [
  'data-theme',
  'data-mode',
  'data-color-mode',
  'data-color-scheme',
  'data-bs-theme',
  'data-theme-mode',
  'data-appearance',
  'theme',
];

const fromValue = (raw) => {
  if (!raw) return null;
  const value = String(raw).toLowerCase();
  // Substring rather than equality: real pages ship `dark-blue`, `theme-dark`
  // and `dracula-dark`, and none of them mean anything else.
  if (value.includes('dark')) return 'dark';
  if (value.includes('light')) return 'light';
  return null;
};

const fromElement = (element) => {
  if (!element) return null;
  for (const attribute of SCHEME_ATTRIBUTES) {
    const found = fromValue(element.getAttribute(attribute));
    if (found) return found;
  }
  const list = element.classList;
  if (list) {
    if (list.contains('dark') || list.contains('dark-mode') || list.contains('theme-dark')) return 'dark';
    if (list.contains('light') || list.contains('light-mode') || list.contains('theme-light')) return 'light';
  }
  return null;
};

export const detectHostScheme = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 'light';

  const root = document.documentElement;
  const declared = fromElement(root) || fromElement(document.body);
  if (declared) return declared;

  // `color-scheme` is the page telling the browser how to paint scrollbars and
  // form controls. A site that sets it has made the same decision we are
  // trying to read, and it survives being set from CSS rather than markup.
  try {
    const computed = window.getComputedStyle(root).colorScheme;
    if (computed && computed !== 'normal' && computed !== 'auto') {
      const hasDark = computed.includes('dark');
      const hasLight = computed.includes('light');
      // `light dark` means "either" — no decision, fall through to the OS.
      if (hasDark && !hasLight) return 'dark';
      if (hasLight && !hasDark) return 'light';
    }
  } catch (_err) { /* jsdom and very old browsers — the media query still works */ }

  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch (_err) { /* no matchMedia — light is the safer default */ }

  return 'light';
};

/**
 * @param {'auto'|'light'|'dark'} [appearance='auto']
 *   `light` / `dark` pin the widget. `auto` follows the host page and keeps
 *   following it — a site's own theme toggle takes effect immediately.
 */
export const useColorScheme = (appearance = 'auto') => {
  const pinned = appearance === 'light' || appearance === 'dark' ? appearance : null;
  const [detected, setDetected] = useState(() => (pinned || detectHostScheme()));

  useEffect(() => {
    if (pinned) {
      setDetected(pinned);
      return undefined;
    }
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;

    // Reading is cheap and React bails out of a re-render when the value is
    // unchanged, so there is nothing to debounce: the observer fires on a
    // class change, we look, and almost always nothing happens.
    const sync = () => setDetected(detectHostScheme());
    sync();

    const observed = { attributes: true, attributeFilter: [...SCHEME_ATTRIBUTES, 'class', 'style'] };
    let observer = null;
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(sync);
      observer.observe(document.documentElement, observed);
      // <body> as well: plenty of togglers put the class there instead, and
      // it may not exist yet when a script in <head> mounts the widget.
      if (document.body) observer.observe(document.body, observed);
      else {
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body && observer) observer.observe(document.body, observed);
          sync();
        }, { once: true });
      }
    }

    let media = null;
    try { media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null; } catch (_err) { media = null; }
    if (media) {
      // `addListener` is the Safari < 14 spelling, and Safari 13 is as far
      // back as the embed build targets.
      if (media.addEventListener) media.addEventListener('change', sync);
      else if (media.addListener) media.addListener(sync);
    }

    return () => {
      if (observer) observer.disconnect();
      if (media) {
        if (media.removeEventListener) media.removeEventListener('change', sync);
        else if (media.removeListener) media.removeListener(sync);
      }
    };
  }, [pinned]);

  return pinned || detected;
};

export default useColorScheme;
