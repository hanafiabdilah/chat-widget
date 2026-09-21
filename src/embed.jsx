// Embed entry — the same widget the npm package exports, but mounting itself.
//
// The npm build hands a React component to a React host. This build is for
// every site that has no React host: a marketing page, a WordPress theme, a
// Shopify storefront. It is loaded by `embed/loader.js` (served as
// `/widget.js`), which reads the settings and pulls this file in.
//
// Three things it has to do that the React surface leaves to the host:
//
//   1. Own `isOpen`. Nobody else holds state here, so the launcher's open and
//      the panel's close land on a `useState` inside this file — and on
//      `window.PinglyChat.open()` for the site's own buttons.
//   2. Mount somewhere that the page's CSS cannot reach. That is a shadow
//      root: the host page keeps its styles, we keep ours, and neither had to
//      agree on class names.
//   3. Build the adapter itself, because the base URL and `deferSession` are
//      embed decisions — see `boot()` below.
//
// Everything below the mount is the ordinary package: `ChatWidget`, the
// templates, the adapter. This file adds no UI of its own.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
// `?inline` keeps the compiled CSS as a string instead of emitting a
// stylesheet: it has to go *inside* the shadow root, and a <link> in the page
// head would never reach it.
import widgetCss from './styles.css?inline';
import { ChatWidget } from './ChatWidget.jsx';
import { createOmnichannelAdapter } from './core/adapters/omnichannelAdapter.js';
import { NUVEMCHAT_BASE_URL } from './core/config.js';

const HOST_ID = 'pingly-chat';
// Just under the 32-bit maximum, leaving room for a site that pins something
// of its own to the very top. The widget still has to win against sticky
// headers and cookie banners, which is what the number is really for.
const DEFAULT_Z_INDEX = 2147483000;
// Any element on the page carrying this attribute opens/closes the widget —
// `<button data-pingly-chat="open">`. The alternative is asking every site to
// write JavaScript for the one thing they all want.
const TRIGGER_ATTRIBUTE = 'data-pingly-chat';

const warn = (...args) => {
  if (typeof console !== 'undefined') console.warn('[pingly-chat]', ...args);
};

/* ------------------------------------------------------------------ *
 * window.PinglyChat
 * ------------------------------------------------------------------ */

/**
 * The public API object, created before React has mounted.
 *
 * A site's "Talk to us" button can be clicked while the bundle is still on the
 * wire, so every method queues until the component binds itself. Dropping
 * those calls would make the widget look broken exactly once per visitor —
 * on the first click, the one that matters.
 */
const createController = () => {
  let impl = null;
  const pending = [];
  const listeners = new Map();

  const call = (name, args) => {
    if (!impl) {
      pending.push([name, args]);
      return undefined;
    }
    return typeof impl[name] === 'function' ? impl[name](...args) : undefined;
  };

  const emit = (event, detail) => {
    const set = listeners.get(event);
    if (set) {
      set.forEach((fn) => {
        try { fn(detail); } catch (err) { warn('listener error', err); }
      });
    }
    // Also on window, so a page can listen without holding a reference to the
    // API object — which is the only option for markup that runs before us.
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(`pingly-chat:${event}`, { detail }));
    }
  };

  const api = {
    open: (...args) => call('open', args),
    close: (...args) => call('close', args),
    toggle: (...args) => call('toggle', args),
    isOpen: () => call('isOpen', []) === true,
    identify: (...args) => call('identify', args),
    destroy: (...args) => call('destroy', args),

    on(event, handler) {
      if (typeof handler !== 'function') return () => {};
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => api.off(event, handler);
    },
    off(event, handler) {
      const set = listeners.get(event);
      if (set) set.delete(handler);
    },

    // Marks this object as the real API rather than a settings literal the
    // site assigned to the same name. `loader.js` reads it for that reason.
    __api: true,
  };

  return {
    api,
    emit,
    bind(next) {
      impl = next;
      if (!impl) return;
      const queued = pending.splice(0, pending.length);
      queued.forEach(([name, args]) => call(name, args));
    },
  };
};

/* ------------------------------------------------------------------ *
 * The component
 * ------------------------------------------------------------------ */

const EmbeddedWidget = ({ settings, adapter, controller, onIdentify, onDestroy }) => {
  const [isOpen, setIsOpen] = useState(!!settings.open);

  // Read by `isOpen()`, which is called from outside React and must not close
  // over a stale render.
  const openRef = useRef(isOpen);
  openRef.current = isOpen;

  useEffect(() => {
    controller.bind({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((value) => !value),
      isOpen: () => openRef.current,
      identify: (user) => onIdentify(user),
      destroy: () => onDestroy(),
    });
    controller.emit('ready', { appId: settings.appId });
    return () => controller.bind(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `open` / `close` describe a transition, so the initial render is not one:
  // a widget that boots closed has not just been closed by anybody.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    controller.emit(isOpen ? 'open' : 'close');
  }, [isOpen, controller]);

  // The site's own buttons. Delegated from the document so markup added later
  // (a modal, a page rendered by the site's framework) works without us
  // rebinding anything.
  useEffect(() => {
    const onClick = (event) => {
      const target = event.target?.closest?.(`[${TRIGGER_ATTRIBUTE}]`);
      if (!target) return;
      const action = target.getAttribute(TRIGGER_ATTRIBUTE) || 'open';
      if (action === 'close') setIsOpen(false);
      else if (action === 'toggle') setIsOpen((value) => !value);
      else setIsOpen(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const initialChatOptions = useMemo(
    () => (Array.isArray(settings.options) ? settings.options : undefined),
    [settings.options],
  );

  return (
    <ChatWidget
      adapter={adapter}
      appId={settings.appId}
      template={settings.template || 'global'}
      theme={settings.theme}
      initialChatOptions={initialChatOptions}
      isOpen={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      debug={!!settings.debug}
    />
  );
};

/* ------------------------------------------------------------------ *
 * Mounting
 * ------------------------------------------------------------------ */

const mount = (settings, controller) => {
  const host = document.createElement('div');
  host.id = HOST_ID;
  // `all: initial` first, then our own three properties. It is what stops the
  // page's inherited styles — colour, font, line-height, direction — from
  // reaching into the shadow tree, which shadow DOM does not block on its own.
  //
  // Fixed + a z-index makes the host a stacking context at the very top, so
  // the panel is never painted under a sticky header. Size zero because
  // nothing is drawn in the host itself: the launcher and the panel are
  // position:fixed against the viewport, and a fixed child is laid out against
  // the viewport no matter what its parent is doing.
  host.style.cssText = [
    'all: initial',
    // `all: initial` leaves the browser's own defaults behind — Times, medium,
    // normal — and everything in the tree that says `font: inherit` (the
    // button reset does, deliberately) would resolve to them. A `:host` rule
    // cannot fix this: it loses to the inline declaration on the same element.
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'font-size: 16px',
    'line-height: normal',
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 0',
    'height: 0',
    `z-index: ${settings.zIndex || DEFAULT_Z_INDEX}`,
  ].join('; ');
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = widgetCss;
  shadow.appendChild(style);

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  // Identity is mutable: `PinglyChat.identify({...})` may run long after boot,
  // and with a deferred session it still arrives before `POST /session` — the
  // visitor's name reaches the dashboard with their first message.
  let identity = settings.user || null;

  const adapter = createOmnichannelAdapter({
    appId: settings.appId,
    baseUrl: settings.apiUrl || NUVEMCHAT_BASE_URL,
    getIdentify: () => identity,
    locale: settings.locale,
    virtualAssistantName: settings.virtualAssistantName,
    // The embed's one behavioural difference from the npm package, and the
    // reason is scale: this script goes on public sites, where boot-time
    // session creation files every passing visitor as a conversation nobody
    // will ever read. Deferred, the row appears when someone writes.
    deferSession: settings.deferSession !== false,
    debug: !!settings.debug,
  });

  const root = createRoot(mountPoint);

  const destroy = () => {
    try { root.unmount(); } catch (err) { warn('unmount failed', err); }
    host.remove();
    window.__pinglyChatMounted = false;
  };

  root.render(
    <EmbeddedWidget
      settings={settings}
      adapter={adapter}
      controller={controller}
      onDestroy={destroy}
      onIdentify={(user) => {
        if (user && typeof user === 'object') identity = { ...(identity || {}), ...user };
      }}
    />,
  );
};

const whenBodyReady = (fn) => {
  if (document.body) { fn(); return; }
  document.addEventListener('DOMContentLoaded', fn, { once: true });
};

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

// Settings normally arrive from the loader. Reading them here as well means
// the bundle also works when dropped straight into a page with a
// `data-app-id` on its own tag — the case where someone skipped the loader.
const readSettings = () => {
  const fromLoader = (typeof window !== 'undefined' && window.__pinglyChatBoot) || null;
  if (fromLoader && fromLoader.settings) {
    return {
      // `NUVEMCHAT_BASE_URL` stays the last resort: it is right in every build
      // we publish, but the loader's own origin is right by construction.
      apiUrl: fromLoader.origin || undefined,
      ...fromLoader.settings,
    };
  }

  const declared = (typeof window !== 'undefined' && window.pinglyChatSettings) || {};
  const script = document.currentScript;
  const appId = script?.dataset?.appId || declared.appId;
  return { ...declared, appId };
};

const boot = () => {
  const settings = readSettings() || {};

  if (!settings.appId) {
    warn('no app id — add data-app-id="…" to the script tag. Widget not loaded.');
    return;
  }
  if (window.__pinglyChatMounted) {
    warn('already loaded on this page — ignoring the second copy.');
    return;
  }
  window.__pinglyChatMounted = true;

  const controller = createController();
  // The loader's stub collected everything called before now; replaying it
  // through the real object is what makes those early calls take effect.
  const queued = (window.PinglyChat && window.PinglyChat.q) || [];
  window.PinglyChat = controller.api;
  queued.forEach(([name, args]) => {
    if (typeof controller.api[name] === 'function') controller.api[name](...args);
  });

  whenBodyReady(() => mount(settings, controller));
};

boot();
