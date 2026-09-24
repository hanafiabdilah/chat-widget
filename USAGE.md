# Usage Guide — @multichat-adslogin/chat-widget

An embeddable React chat widget. A single component that already includes
drag-and-drop attachments, realtime messaging, quick-reply chips, and a built-in
emoji picker.

This document walks through every step from installation to a running widget in
your app.

---

## 1. Prerequisites

- **Node.js** 18+ and **npm** (or yarn / pnpm).
- A **React 18+** app (Vite, Next.js, Create React App, etc).
- An **`appId`** from the MultiChat dashboard. This is required — without an
  `appId` the widget will not render.

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

The widget ships its own stylesheet that **won't leak into** the host page's
styles. Import the CSS **once** near your app's entry point:

```js
import '@multichat-adslogin/chat-widget/styles.css';
```

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

**Only `appId` is required.** Everything else — template, brand color, welcome
message — is configured from the MultiChat dashboard and loaded automatically by
the widget.

---

## 5. Props reference

| Prop                  | Type                                          | Required | Notes |
| --------------------- | --------------------------------------------- | :------: | ----- |
| `appId`               | `string`                                      |    ✓     | Your connection identifier from the MultiChat dashboard. |
| `isOpen`              | `boolean`                                     |          | Controlled open/close state of the panel. |
| `onOpen`              | `() => void`                                  |          | Called when the panel opens. |
| `onClose`             | `() => void`                                  |          | Called when the panel closes. |
| `user`                | `{ name?, email?, meta? }`                    |          | Identifies the visitor to the support agent. |
| `accent`              | `string`                                      |          | Brand colour. Defaults to the workspace's `connection.color`. Any hex or `rgb()`. |
| `appearance`          | `'auto' \| 'light' \| 'dark'`                  |          | `auto` (default) follows the host page. |
| `colors`              | `Partial<Palette>` or `{ light, dark }`       |          | Overrides for individual palette keys. |
| `home`                | `boolean`                                     |          | Home screen before the composer. Default `true`. |
| `greeting`            | `{ title?, subtitle? }`                       |          | Overrides the home screen's greeting. |
| `agents`              | `Array<{ name, avatarUrl?, color? }>`         |          | Faces in the home hero. Strings are accepted too. |
| `logoUrl`             | `string`                                      |          | Square mark in the hero. Falls back to the workspace's initial. |
| `locale`              | `string`                                      |          | `pt-BR` (default), `en`, `es`, `id`. Also sets the clock format on bubbles. |
| `strings`             | `Partial<Strings>`                            |          | Overrides for individual lines — keys in `src/i18n/strings.js`. |
| `theme`               | `Theme`                                       |          | Colour overrides for the **proxybr** template only. |
| `template`            | `'proxybr' \| 'global'`                       |          | Initial template hint. The dashboard setting takes over once loaded. |
| `initialChatOptions`  | `Array<{ id, label, color?, message? }>`      |          | Quick-reply chips shown until the visitor sends their first message. |
| `debug`               | `boolean`                                     |          | Enables verbose lifecycle logging in the console. |

### Note on `user`

The `user` field identifies the visitor to the agent. The widget reads `name`
(or `full_name` / `firstName`), `email`, and `meta`. You can safely pass an
inline object literal.

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

Clicking a chip sends `message` if provided, otherwise the `label`, as a normal
visitor message. Use `message` when you want a short chip label but a fuller
message to reach the agent.

| Field     | Required | Notes |
| --------- | :------: | ----- |
| `id`      |    ✓     | Stable key for React reconciliation. |
| `label`   |    ✓     | Text shown on the chip, also the default text sent when clicked. |
| `message` |          | Override the text sent to the agent. |
| `color`   |          | Chip accent color (hex). |

---

## 7. Appearance

### The home screen

The panel opens on a greeting, the conversation waiting to be picked up, and
one button that starts a new one. There is no tab bar: the only other place to
be is the conversation itself, and the card describing it is what opens it —
the chat header carries a back arrow to return.

```jsx
<ChatWidget
  appId="..."
  greeting={{ title: 'Olá 👋', subtitle: 'Como podemos ajudar?' }}
  agents={[
    { name: 'Ana Souza', avatarUrl: 'https://…/ana.jpg' },
    { name: 'Bruno Lima' },
  ]}
  logoUrl="https://…/logo.png"
/>
```

`agents` are the faces in the hero. With none supplied the widget shows
whoever is currently replying, and with nobody to show it draws nothing —
a row of grey placeholders would promise people who are not there.

`home={false}` opens straight into the composer, which is how the widget
behaved before this screen existed.

### Colour

One value drives the whole palette. It comes from the connection in the
dashboard, so a workspace repaints its widget everywhere at once; `accent`
overrides it for a host that would rather match its own product.

```jsx
<ChatWidget appId="..." accent="#7c3aed" />
```

Everything else is derived and measured before it is used. The label on a
filled surface is whichever of black or white reads better on it, so a pale
yellow brand gets dark buttons rather than white-on-yellow; the accent used as
*ink* — links, icons, a chip's border — is nudged until it clears a reading
threshold against the panel, so a near-black brand stays visible on a dark
one. Individual keys can still be overridden:

```jsx
<ChatWidget
  appId="..."
  colors={{ dark: { bg: '#000000', surface: '#0d0d0d' } }}
/>
```

### Dark mode

`appearance` defaults to `auto`, which reads the host page rather than
assuming: `data-theme` (and `data-mode`, `data-bs-theme`, …), a `dark` or
`light` class on `<html>` or `<body>`, the CSS `color-scheme` property, and
finally `prefers-color-scheme`. All of them are watched, so a visitor using
the site's own theme toggle takes the widget with them. Pin it with
`appearance="light"` or `appearance="dark"`.

### Language

`locale` picks one of the built-in dictionaries (`pt-BR`, `en`, `es`, `id`) and the
clock format on message bubbles. Individual lines can be replaced without
forking a dictionary:

```jsx
<ChatWidget appId="..." locale="id" strings={{ sendMessage: 'Hubungi kami' }} />
```

### Templates

The template is ultimately decided by your dashboard setting, which **always
wins** over the `template` prop — that prop is only a hint for the moment
before the configuration loads. `global` is the brand-neutral one described
above; `proxybr` is ProxyBR's own chrome and keeps its `theme` prop.

---

## 8. Features that work out of the box

Once mounted, the widget automatically handles:

- **Realtime messaging** — visitor and agent messages update live, no polling
  needed on your side.
- **Attachments** — drag-and-drop or file picker, with caption input and inline
  preview (image / audio / video / document).
- **Emoji picker** — built-in, ~250 emojis across 6 categories, inserts at the cursor.
- **Conversation status** — when a chat is resolved, the input is replaced with a
  "Start new conversation" button.
- **Unread badge** — increments when the agent replies, clears when the panel opens.
- **"Connecting…" placeholder** — shown while loading or on transient errors,
  instead of a broken UI.
- **Self-contained styles** — the widget's CSS is scoped and won't affect your
  page's styles.
- **Reduced motion** — panel and view animations are dropped for visitors whose
  system asks for it.
- **Lightweight** — ~22 KB gzipped, with no extra runtime dependencies beyond the
  peer dependencies.

---

## 9. Full example

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
      />
    </div>
  );
}
```

---

## 10. Troubleshooting

| Symptom | Likely cause & fix |
| ------- | ------------------ |
| Widget doesn't appear at all | `appId` is empty/not provided (check for the `[chat-widget] appId is required` warning in the console), or the connection is disabled in the dashboard. |
| Stuck on "Connecting…" | The `appId` is invalid, or there's a temporary network issue. Double-check the `appId` from your dashboard. |
| Widget styles look broken | The CSS wasn't imported. Make sure `import '@multichat-adslogin/chat-widget/styles.css';` is present. |
| Icon / `lucide-react` error | The `lucide-react` peer dependency isn't installed. Run `npm install lucide-react`. |

---

## License

MIT © MultiChat
