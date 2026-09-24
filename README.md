# @multichat-adslogin/chat-widget

Embeddable React chat widget for the MultiChat / Nuvemchat Live Chat API.
One component, a home screen, drag-and-drop attachments, realtime via Laravel
Reverb, and a built-in emoji picker. Takes its colour from the workspace and
follows the host site into dark mode.

```bash
npm install @multichat-adslogin/chat-widget lucide-react
```

`react`, `react-dom`, and `lucide-react` are **peer dependencies** —
install them in the host app.

---

## Quick start

```jsx
import { ChatWidget } from '@multichat-adslogin/chat-widget';
import '@multichat-adslogin/chat-widget/styles.css';

export default function App() {
  const [open, setOpen] = useState(false);
  return (
    <ChatWidget
      appId="550e8400-e29b-41d4-a716-446655440000"
      isOpen={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      user={{ name: 'Budi', email: 'budi@example.com' }}
    />
  );
}
```

Only `appId` is required. The widget pulls everything else — template,
brand color, accept message, realtime credentials — from
`GET /widget-api/config/{appId}` at boot.

## Props

| Prop                  | Type                                          | Required | Notes |
| --------------------- | --------------------------------------------- | :------: | ----- |
| `appId`               | `string`                                      |    ✓     | Connection identifier from the MultiChat dashboard. |
| `isOpen`              | `boolean`                                     |          | Controlled open state. |
| `onOpen` / `onClose`  | `() => void`                                  |          | Open/close callbacks. |
| `user`                | `{ name?, email?, meta? }`                    |          | Forwarded as `identify` data when the session is created. |
| `accent`              | `string`                                      |          | Brand colour. Defaults to the workspace's `connection.color`. |
| `appearance`          | `'auto' \| 'light' \| 'dark'`                  |          | `auto` (default) follows the host page. |
| `colors`              | `Partial<Palette>` or `{ light, dark }`       |          | Overrides for individual palette keys. |
| `home`                | `boolean`                                     |          | Home screen before the composer. Default `true`. |
| `greeting`            | `{ title?, subtitle? }`                       |          | Overrides the home screen's greeting. |
| `agents`              | `Array<{ name, avatarUrl?, color? }>`         |          | Faces in the home hero. |
| `logoUrl`             | `string`                                      |          | Square mark in the hero. Falls back to the workspace's initial. |
| `locale`              | `string`                                      |          | `pt-BR` (default), `en`, `id`. Also sets the clock format. |
| `strings`             | `Partial<Strings>`                            |          | Overrides for individual lines — see `src/i18n/strings.js`. |
| `theme`               | `Theme`                                       |          | Colour overrides for the **proxybr** template only. |
| `template`            | `'proxybr' \| 'global'`                       |          | Initial template hint. Backend `template_type` always wins once config loads. |
| `initialChatOptions`  | `Array<{ id, label, color?, message? }>`      |          | Quick-reply chips shown until the visitor sends their first message. |
| `deferSession`        | `boolean`                                     |          | Wait for the visitor's first message before creating the conversation. Default `false`. |
| `debug`               | `boolean`                                     |          | Enables verbose lifecycle logging in the console. |

### `initialChatOptions` example

```jsx
<ChatWidget
  appId="..."
  initialChatOptions={[
    { id: 'pricing', label: '💰 Tanya harga', color: '#22c55e' },
    { id: 'demo',    label: '🎥 Minta demo',   color: '#06b6d4',
      message: 'Halo, saya ingin minta demo produk.' },
  ]}
/>
```

Each click POSTs `option.message || option.label` to the API as a normal
visitor message. The chips disappear after the visitor sends anything.

---

## Features

- **Single component** — drop in, no provider setup, no manual wiring.
- **Home screen** — a greeting, the conversation waiting to be picked up, and one button to start a new one. No tab bar: the only other place to be is the conversation, and the card that describes it is what opens it.
- **One accent, whole theme** — the workspace's brand colour produces the launcher, the hero, the bubbles and the links, each measured for contrast against the surface it lands on. Pale brands get dark ink, dark brands get light ink, and a brand the colour of the panel still has a visible launcher.
- **Dark mode that follows the site** — `data-theme`, a `dark` class, the CSS `color-scheme` property, then the OS preference. Re-read whenever the page changes its mind, so a visitor flipping the site's own theme switch takes the widget with them.
- **Dual templates** — `proxybr` (dark, themable) and `global` (brand-neutral, light and dark). Backend picks via `template_type`.
- **REST + Realtime** — `GET /config`, `POST /session`, `POST /messages`, `GET /messages`, `GET /session` (status), `POST /seen`, plus WebSocket subscription to `widget-session.{token}` for agent replies and conversation status changes.
- **Attachments** — drag-and-drop OR file picker. Pre-uploads via `POST /uploads`, shows preview with caption input, renders inline in bubbles (image/audio/video/document with download).
- **Initial chat options** — dynamic chips configured via props, each click sends a message.
- **Emoji picker** — built-in, ~250 emojis across 6 categories, inserts at cursor.
- **Conversation status** — detects `pending → active → resolved` transitions via WS event; resolved state replaces input with "Start new conversation" CTA.
- **Unread badge** — driven by `unread_count` from `GET /session`, auto-incremented on agent WS push, cleared on widget open via `POST /seen`.
- **Not-ready placeholder** — invalid `app_id`, loading, or transient errors all show a neutral "Connecting…" placeholder instead of breaking.
- **Self-contained CSS** — Tailwind utilities scoped to `.cw-root`, host page styles untouched. No preflight reset bleeding into the embedding site.
- **~19 KB gzipped** — minimal Pusher-protocol WebSocket client inline (no `laravel-echo` / `pusher-js` dependency).

---

## Embed build (no npm, no React)

Most sites that want a chat widget have no build step at all, so there is a
second distribution: one script tag, served by the platform.

```html
<script src="https://chat.pingly.com.br/widget.js" data-app-id="YOUR_APP_ID" async></script>
```

That is the whole installation. The same components, the same adapter — the
difference is that this build mounts itself:

- into a **shadow root** on a host element wiped with `all: initial`, so the
  page's CSS cannot reach the widget and the widget cannot reach the page;
- with **React bundled** (nothing is expected of the host) and Tailwind's
  `rem` values compiled to `px`, because `rem` resolves against the page's
  `<html>` and shadow DOM does not isolate that — a site with
  `html { font-size: 62.5% }` would otherwise shrink the whole widget;
- with `deferSession: true`, so a visitor who never writes never becomes a
  conversation row.

### Settings

`data-app-id` is the only required one. Anything more goes in an object
declared **before** the script tag:

```html
<script>
  window.pinglyChatSettings = {
    appId: "YOUR_APP_ID",
    user: { name: "Maria", email: "maria@example.com" },  // arrives with the conversation
    open: true,            // start with the panel open
    zIndex: 2147483000,    // against a very insistent sticky header
    apiUrl: "https://…",   // default: the origin that served widget.js
    locale: "pt-BR",       // pt-BR | en | id

    // Appearance. Both are optional: the colour comes from the workspace and
    // the scheme from your page.
    accent: "#7c3aed",     // overrides the dashboard's colour for this site
    appearance: "auto",    // auto | light | dark
    colors: { dark: { bg: "#000000" } },

    // Home screen
    home: true,            // false opens straight into the composer
    greeting: { title: "Olá 👋", subtitle: "Como podemos ajudar?" },
    agents: [{ name: "Ana Souza", avatarUrl: "https://…/ana.jpg" }],
    logoUrl: "https://…/logo.png",

    debug: true,
  };
</script>
<script src="https://chat.pingly.com.br/widget.js" async></script>
```

Also accepted on the tag: `data-api-url`, `data-template`, `data-z-index`,
`data-locale`, `data-accent`, `data-appearance`, `data-logo-url`,
`data-home="false"`, `data-open="true"`, `data-debug="true"`, and `?id=APP_ID`
on the script URL for page builders that strip unknown attributes.

### Colour and dark mode

The accent comes from the connection in the dashboard, so a workspace changes
its widget everywhere at once without anybody editing a snippet. `accent` on
the embedding site overrides it, for a host that would rather match its own
product than its supplier's.

Everything else is derived from that one value and measured before it is used:
the label on a filled surface is whichever of black or white reads better on
it, and the accent-as-ink (links, icons, the thin border on a chip) is nudged
until it clears a real reading threshold against the panel. A workspace whose
brand is near-black gets a launcher that is still visible on a dark page.

The colour scheme is read from the host page rather than assumed, in this
order: `data-theme` (and `data-mode`, `data-bs-theme`, …), a `dark` or `light`
class on `<html>` or `<body>`, the CSS `color-scheme` property, and finally
`prefers-color-scheme`. All of them are watched, so a visitor using the site's
own theme toggle sees the widget follow. Pin it with
`appearance: "light" | "dark"` if the site would rather it did not.

### Opening it from the site

Any element with `data-pingly-chat` opens (or closes, or toggles) the widget —
no JavaScript on the site's side:

```html
<button data-pingly-chat="open">Talk to us</button>
<button data-pingly-chat="toggle">Chat</button>
```

Or imperatively, through `window.PinglyChat`:

| Call | What it does |
|---|---|
| `.open()` / `.close()` / `.toggle()` | Panel state. |
| `.isOpen()` | `true` while the panel is open. |
| `.identify({ name, email, meta })` | Visitor details; they reach the dashboard with the first message. |
| `.on('ready' \| 'open' \| 'close', fn)` | Returns an unsubscribe function. |
| `.destroy()` | Unmounts and removes the widget. |

Calls made while the bundle is still loading are queued by the loader and
replayed — a visitor clicking the site's own button one second after page load
is not ignored. The same three events are also dispatched on `window` as
`pingly-chat:ready`, `pingly-chat:open`, `pingly-chat:close`.

### Building and publishing it

```bash
npm run build:embed     # dist-embed/widget.js + dist-embed/widget/pingly-chat.<hash>.js
npm run publish:embed   # copies both into ../nuvemchat-be-2/public
npm run release:embed   # both of the above
```

The loader is tiny and short-lived; the bundle is content-hashed and cached
forever. The platform serves them from `/widget.js` and `/widget/*` — see
`nuvemchat-be-2/docs/chat-widget-embed.md` for the deploy order and the Caddy
block they need.

Local check: `npm run build:embed && npm run dev`, then open
`/embed-demo.html` — a page built to be hostile on purpose.

---

## Looking at it locally

`npm run dev` serves two harnesses on `:5174`:

| Page | What it is for |
| ---- | -------------- |
| `/preview.html` | The widget driven by a fake adapter. No backend, no app id, no conversation to be in the middle of — which is what makes the states worth checking reachable: dark mode, a brand colour nobody has chosen yet, the home screen of a first-time visitor. |
| `/` | `playground.jsx`, talking to the real API. Needs `VITE_WIDGET_APP_ID` in `.env.local`. |
| `/embed-demo.html` | The embed build on a page that is hostile on purpose (62.5% root font-size, a sticky header at z-index 999999, blanket `!important` on every button). Run `npm run build:embed` first. |

The preview takes query parameters, so a state can be linked to rather than
described:

```
/preview.html?scheme=dark&accent=%2316a34a&history=0&locale=id
```

`scheme` is `light`, `dark` or `auto` — `auto` plus the page's own theme
button is how the host-page-following behaviour is checked.

---

## Backend configuration

The widget API base URL is **baked in at build time** (defaults to a hardcoded URL in `src/core/config.js`). Override via `VITE_WIDGET_BASE_URL` when building from source:

```bash
VITE_WIDGET_BASE_URL=https://your-backend.example.com npm run build
```

See `API.md` in this repo for the full backend contract.

---

## Programmatic API via ref

```jsx
import { useRef } from 'react';
import { ChatWidget } from '@multichat-adslogin/chat-widget';

// The conversation object exposes:
//   .messages, .conversationStatus, .unreadCount, .currentAgent
//   .sendMessage(text, { attachment? | attachmentUrl? })
//   .retryMessage(id) — re-send a message whose deliveryStatus is 'failed'
//   .uploadAttachment(file) → { url, message_type, ... }
//   .markSeen()
//   .refreshStatus()
//   .reset() — clear session_token + bootstrap a new conversation
```

A future release will expose this via an imperative ref. For now, the
widget owns the conversation hook internally.

### Optimistic sending

`sendMessage` draws the bubble before the request leaves, so the thread never
sits empty while a round trip the visitor cannot see decides whether their
message existed. Each visitor message carries a `deliveryStatus`:

| Value | Meaning | Rendered as |
|---|---|---|
| `pending` | Drawn locally, request in flight | Faded bubble, clock icon |
| `sent` | Server echoed it back | Normal bubble, delivery tick |
| `failed` | Send errored; the draft is still held | "Não enviado · tentar novamente" — tapping calls `retryMessage(id)` |

Until it is acknowledged the bubble carries a client-side string id
(`pending:1`); the server's echo replaces it **in place**, so a reply that
arrived while it was in flight does not get reordered.

A send that fails with `404` (session expired server-side) rebuilds the session
and retries once on its own — the visitor never asked for a new session and
should not have to retype a message to discover they got one.

Pass the whole upload payload as `attachment` rather than just `attachmentUrl`
when you have it: the extra fields (`message_type`, `filename`) are what let
the optimistic bubble draw the image immediately instead of an empty frame.
`attachmentUrl` on its own still works.

### Pasting images

Both templates accept an image pasted into the composer (`Ctrl`/`Cmd`+`V`) and
stage it exactly like a dropped or picked file — a screen capture lives on the
clipboard as bytes, not as a file on disk, so without this the visitor has to
save it somewhere just to attach it. The paste handler is bound to the input,
not the document: a global listener inside an embedded widget would swallow
pastes meant for the host page. Any text already typed stays as the caption.

---

## License

MIT © MultiChat
