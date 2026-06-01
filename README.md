# @multichat-adslogin/chat-widget

Embeddable React chat widget for the MultiChat / Nuvemchat Live Chat API.
One component, drag-and-drop attachments, realtime via Laravel Reverb,
configurable initial chat options, and a built-in emoji picker.

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
| `theme`               | `Theme`                                       |          | Color overrides for the ProxyBR template (dark). The Global template has its own light palette. |
| `template`            | `'proxybr' \| 'global'`                       |          | Initial template hint. Backend `template_type` always wins once config loads. |
| `initialChatOptions`  | `Array<{ id, label, color?, message? }>`      |          | Quick-reply chips shown until the visitor sends their first message. |
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
- **Dual templates** — `proxybr` (dark, themable) and `global` (light, fixed palette). Backend picks via `template_type`.
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
//   .sendMessage(text, { attachmentUrl? })
//   .uploadAttachment(file) → { url, message_type, ... }
//   .markSeen()
//   .refreshStatus()
//   .reset() — clear session_token + bootstrap a new conversation
```

A future release will expose this via an imperative ref. For now, the
widget owns the conversation hook internally.

---

## License

MIT © MultiChat
