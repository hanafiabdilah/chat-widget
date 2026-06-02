# Usage Guide — @multichat-adslogin/chat-widget

Embeddable React chat widget for the MultiChat / Nuvemchat Live Chat API.
A single component that already includes drag-and-drop attachments, realtime
via Laravel Reverb (WebSocket), quick-reply chips, and a built-in emoji picker.

This document walks through every step from installation to a running widget in
your app.

---

## 1. Prerequisites

- **Node.js** 18+ and **npm** (or yarn / pnpm).
- A **React 18+** app (Vite, Next.js, Create React App, etc).
- An **`appId`** (connection UUID) from the MultiChat dashboard. This is
  required — without an `appId` the widget will not render.

---

## 2. Installation

Install the package together with its peer dependencies:

```bash
npm install @multichat-adslogin/chat-widget lucide-react
```

`react`, `react-dom`, and `lucide-react` are **peer dependencies** — meaning
this package does not bundle them, and you must make sure all three exist in the
host app:

| Package        | Minimum version |
| -------------- | --------------- |
| `react`        | `>=18`          |
| `react-dom`    | `>=18`          |
| `lucide-react` | `>=0.300.0`     |

If your project already uses React, then `react` and `react-dom` are usually
already installed — you only need to add `lucide-react`.

With yarn / pnpm:

```bash
yarn add @multichat-adslogin/chat-widget lucide-react
# or
pnpm add @multichat-adslogin/chat-widget lucide-react
```

---

## 3. Import the CSS (required, once)

The widget ships its own stylesheet scoped to `.cw-root`, so it **won't leak
into** the host page's styles. Import the CSS **once** near your app's entry
point:

```js
import '@multichat-adslogin/chat-widget/styles.css';
```

> The CSS is intentionally separated from the JS module so SSR/CJS users aren't
> forced to handle stylesheets. You decide when to import it.

---

## 4. Basic usage (Quick Start)

Mount the `<ChatWidget>` component once near the root of your app. The panel's
open/close state is controlled by you through the `isOpen` / `onOpen` /
`onClose` props.

```jsx
import { useState } from 'react';
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

**Only `appId` is required.** Everything else — template, brand color, accept
message, realtime credentials — is pulled automatically by the widget from
`GET /widget-api/config/{appId}` at boot. The brand (title + accent color) is
configured from the dashboard, not from the embed code.

---

## 5. Props reference

| Prop                  | Type                                          | Required | Notes |
| --------------------- | --------------------------------------------- | :------: | ----- |
| `appId`               | `string`                                      |    ✓     | Connection identifier from the MultiChat dashboard. |
| `isOpen`              | `boolean`                                     |          | Controlled open/close state of the panel. |
| `onOpen`              | `() => void`                                  |          | Called when the panel opens. |
| `onClose`             | `() => void`                                  |          | Called when the panel closes. |
| `user`                | `{ name?, email?, meta? }`                    |          | Sent as `identify` data when the session is created. |
| `theme`               | `Theme`                                       |          | Color overrides for the **proxybr** template (dark). The **global** template has its own light palette. |
| `template`            | `'proxybr' \| 'global'`                       |          | Initial template hint. Backend `template_type` always wins once config loads. |
| `initialChatOptions`  | `Array<{ id, label, color?, message? }>`      |          | Quick-reply chips shown until the visitor sends their first message. |
| `debug`               | `boolean`                                     |          | Enables verbose lifecycle logging in the console. |
| `adapter`             | `ChatAdapter`                                 |          | (Advanced) Custom adapter — useful for testing. When provided, `appId` is ignored. |

### Note on `user`

The `user` field is forwarded as `identify` data when the session is created
(`POST /session`). The widget reads `name` (or `full_name` / `firstName`),
`email`, and `meta`. You may pass an inline object literal — the widget reads its
value via a ref so it won't restart the boot flow on every parent re-render.

---

## 6. Quick-reply chips (`initialChatOptions`)

Show shortcut buttons above the input. The chips disappear after the visitor
sends any message.

```jsx
<ChatWidget
  appId="550e8400-e29b-41d4-a716-446655440000"
  initialChatOptions={[
    { id: 'pricing', label: '💰 Ask about pricing', color: '#22c55e' },
    { id: 'support', label: '⚠️ Technical help', color: '#f59e0b' },
    {
      id: 'demo',
      label: '🎥 Request a demo',
      color: '#06b6d4',
      message: 'Hi, I would like to request a product demo.', // the text actually sent
    },
  ]}
/>
```

Each click sends `option.message || option.label` to the API as a normal visitor
message (there is no special endpoint). Use `message` when you want a short chip
label but a fuller message to reach the agent.

| Field     | Required | Notes |
| --------- | :------: | ----- |
| `id`      |    ✓     | Stable key for React reconciliation. |
| `label`   |    ✓     | Text shown on the chip, also the default text sent when clicked. |
| `message` |          | Override the text sent to the agent. |
| `color`   |          | Chip accent color (hex). |

---

## 7. Templates & theming

Two templates are available:

- **`proxybr`** — dark appearance, colors can be overridden via the `theme` prop.
- **`global`** — light appearance with a fixed palette.

The backend decides the template via `template_type`, and the **backend value
always wins** over the `template` prop. The `template` prop is only an initial
hint before the config loads.

Example theme override (only applies to the proxybr template):

```jsx
<ChatWidget
  appId="..."
  template="proxybr"
  theme={{ accent: '#7c3aed' /* ...other color overrides... */ }}
/>
```

> If the backend sends an `accentColor`, that value overrides the `theme.accent`
> you provide — brand color is owned by the connection in the dashboard.

---

## 8. Configuring the backend API (building from source)

The API base URL is **baked in at build time** (defaults to a hardcoded URL in
[src/core/config.js](src/core/config.js#L13) →
`https://back-chat.adslogin.com.br`). Embedders do **not** pass the base URL via
props.

If you build the package from source and need to point it at a different
backend, set the `VITE_WIDGET_BASE_URL` environment variable at build time:

```bash
VITE_WIDGET_BASE_URL=https://your-backend.example.com npm run build
```

The full backend API contract is documented in [API.md](API.md).

---

## 9. Features that work out of the box

Once mounted, the widget automatically handles:

- **REST + Realtime** — `GET /config`, `POST /session`, send/receive messages,
  plus a WebSocket subscription to the `widget-session.{token}` channel for agent
  replies and conversation status changes.
- **Attachments** — drag-and-drop or file picker. Pre-uploads via `POST /uploads`,
  preview with caption input, renders inline (image/audio/video/document).
- **Emoji picker** — built-in, ~250 emojis across 6 categories, inserts at the cursor.
- **Conversation status** — detects `pending → active → resolved` transitions.
  When resolved, the input is replaced with a "Start new conversation" button.
- **Unread badge** — driven by `unread_count`, increments when the agent replies,
  clears when the panel opens (`POST /seen`).
- **"Connecting…" placeholder** — invalid `app_id`, loading, or transient errors
  show a neutral placeholder instead of a broken UI.
- **Self-contained CSS** — Tailwind utilities scoped to `.cw-root`, host styles
  untouched.
- **Lightweight** — ~19 KB gzipped, an inline Pusher-protocol WebSocket client
  (no `laravel-echo` / `pusher-js`).

---

## 10. Connection status handling

The widget reacts automatically to the backend status:

| Status        | Widget behavior |
| ------------- | --------------- |
| `loading`     | Shows the "Connecting…" placeholder. |
| `ready`       | Chat is active & live. |
| `unavailable` | Invalid `app_id` (`422`) — the widget **stays visible** with a "not ready" placeholder so visitors don't see an empty/broken chat. |
| `inactive`    | Connection disabled by the owner (`403`) — the widget is **fully hidden** and will not retry. |
| `error`       | Transient transport error (network / 5xx) — the UI stays visible. |

Enable `debug` to see lifecycle details in the console:

```jsx
<ChatWidget appId="..." debug />
```

---

## 11. Full example

```jsx
import { useState } from 'react';
import { ChatWidget } from '@multichat-adslogin/chat-widget';
import '@multichat-adslogin/chat-widget/styles.css';

export default function App() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* your page content */}

      <button onClick={() => setOpen((v) => !v)}>
        {open ? 'Close chat' : 'Open chat'}
      </button>

      <ChatWidget
        appId="550e8400-e29b-41d4-a716-446655440000"
        isOpen={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        user={{ name: 'Anderson', email: 'anderson@example.com' }}
        initialChatOptions={[
          { id: 'pricing', label: '💰 Ask about pricing', color: '#22c55e' },
          { id: 'support', label: '⚠️ Technical help', color: '#f59e0b' },
          { id: 'demo', label: '🎥 Request a demo', color: '#06b6d4',
            message: 'Hi, I would like to request a product demo.' },
          { id: 'human', label: '🎧 Talk to an agent', color: '#a855f7' },
        ]}
        debug
      />
    </div>
  );
}
```

---

## 12. Advanced usage

The package also exports low-level building blocks for hosts that want to build
their own adapter without re-implementing the wire protocol:

```js
import {
  ChatWidget,
  templates, ProxybrTemplate, GlobalTemplate,
  createOmnichannelAdapter,
  useConversation,
  createRestClient, ApiError,
  createRealtimeClient,
  createWidgetStorage,
  mapMessage, agentFromResource,
} from '@multichat-adslogin/chat-widget';
```

The `conversation` object (used internally via `useConversation`) exposes:

- `.messages`, `.conversationStatus`, `.unreadCount`, `.currentAgent`
- `.sendMessage(text, { attachmentUrl? })`
- `.uploadAttachment(file)` → `{ url, message_type, ... }`
- `.markSeen()`
- `.refreshStatus()`
- `.reset()` — clear the `session_token` & start a new conversation

---

## 13. Troubleshooting

| Symptom | Likely cause & fix |
| ------- | ------------------ |
| Widget doesn't appear at all | `appId` is empty/not provided (check for the `[chat-widget] appId is required` warning in the console), or the connection is `inactive` (403). |
| Stuck on "Connecting…" | Invalid `app_id` (`unavailable`/422) or the backend is unreachable. Verify `appId` & network connectivity to the base URL. |
| Widget styles look broken | The CSS wasn't imported. Make sure `import '@multichat-adslogin/chat-widget/styles.css';` is present. |
| Icon / `lucide-react` error | The `lucide-react` peer dependency isn't installed. Run `npm install lucide-react`. |
| Realtime not updating | Make sure the backend sends valid Reverb credentials via `/config`, and that the WebSocket isn't blocked by a firewall/proxy. |

---

## License

MIT © MultiChat
